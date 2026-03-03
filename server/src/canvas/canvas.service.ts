import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  CanvasState,
  CanvasSummary,
  AuctionInfo,
  PixelHistoryEntry,
  LeaderboardEntry,
} from './canvas.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CanvasService implements OnModuleDestroy {
  private readonly logger = new Logger(CanvasService.name);

  private canvases = new Map<number, CanvasState>();
  private auctions = new Map<number, AuctionInfo>();
  private syncing = false;

  /** canvasId -> ordered pixel history */
  private pixelHistory = new Map<number, PixelHistoryEntry[]>();
  /** address (lowercase) -> total pixel count */
  private painterStats = new Map<string, number>();
  /** canvasId -> cached thumbnail data */
  private thumbnailCache = new Map<
    number,
    { width: number; height: number; pixels: number[] }
  >();

  /** Pixel history buffer for batched Supabase writes */
  private historyBuffer: (PixelHistoryEntry & { canvasId: number })[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly FLUSH_INTERVAL_MS = 500;
  private static readonly FLUSH_THRESHOLD = 50;

  /** DB32 palette hex values (index 0-32) */
  private static readonly DB32_HEX = [
    '#FFFFFF', // 0 = empty/white
    '#000000', '#222034', '#45283c', '#663931', '#8f563b',
    '#df7126', '#d9a066', '#eec39a', '#fbf236', '#99e550',
    '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39',
    '#3f3f74', '#306082', '#5b6ee1', '#639bff', '#5fcde4',
    '#cbdbfc', '#ffffff', '#9badb7', '#847e87', '#696a6a',
    '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba',
    '#8f974a', '#8a6f30',
  ];

  constructor(private readonly supabase: SupabaseService) {
    // Start flush timer for pixel history buffer
    this.flushTimer = setInterval(() => {
      this.flushHistoryBuffer();
    }, CanvasService.FLUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Flush remaining buffer
    this.flushHistoryBuffer();
  }

  getCanvasState(canvasId: number): CanvasState | undefined {
    return this.canvases.get(canvasId);
  }

  getAllCanvases(): CanvasState[] {
    return Array.from(this.canvases.values());
  }

  getAllCanvasesSummary(): CanvasSummary[] {
    return this.getAllCanvases().map(
      ({ pixels: _pixels, ...summary }) => summary,
    );
  }

  paintPixel(
    canvasId: number,
    x: number,
    y: number,
    colorIndex: number,
    _painter: string,
  ): { success: boolean; completed: boolean } {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) {
      return { success: false, completed: false };
    }

    if (canvas.state !== 'active') {
      return { success: false, completed: false };
    }

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
      return { success: false, completed: false };
    }

    if (colorIndex < 1 || colorIndex > 31) {
      return { success: false, completed: false };
    }

    const linearIndex = y * canvas.width + x;
    const previousColor = canvas.pixels[linearIndex];
    canvas.pixels[linearIndex] = colorIndex;

    if (previousColor === 0) {
      canvas.filledPixels++;
    }

    // Record pixel in history and update painter stats
    this.handlePixelPainted(
      canvasId,
      x,
      y,
      colorIndex,
      _painter,
      Math.floor(Date.now() / 1000),
    );

    // Write-through: update pixels in Supabase
    this.supabase
      .updateCanvasPixels(canvasId, canvas.pixels, canvas.filledPixels)
      .catch((err) =>
        this.logger.error(`Supabase pixel update failed: ${err.message}`),
      );

    const completed = canvas.filledPixels === canvas.totalPixels;
    return { success: true, completed };
  }

  handleCanvasCreated(
    canvasId: number,
    data: Partial<CanvasState>,
  ): void {
    const width = data.width || 0;
    const height = data.height || 0;
    const canvas: CanvasState = {
      canvasId,
      proposer: data.proposer || '',
      title: data.title || '',
      description: data.description || '',
      width,
      height,
      totalPixels: width * height,
      filledPixels: 0,
      pixels: new Uint8Array(width * height),
      state: 'active',
      cooldownSeconds: data.cooldownSeconds || 0,
      auctionStartPrice: data.auctionStartPrice || BigInt(0),
      auctionDuration: data.auctionDuration || 0,
      createdAt: data.createdAt || Math.floor(Date.now() / 1000),
    };
    this.canvases.set(canvasId, canvas);

    // Write-through
    this.supabase.upsertCanvas(canvas).catch((err) =>
      this.logger.error(`Supabase canvas upsert failed: ${err.message}`),
    );
  }

  handleCanvasStateChange(
    canvasId: number,
    newState: CanvasState['state'],
  ): void {
    const canvas = this.canvases.get(canvasId);
    if (canvas) {
      canvas.state = newState;

      // Write-through
      this.supabase.updateCanvasState(canvasId, newState).catch((err) =>
        this.logger.error(`Supabase state update failed: ${err.message}`),
      );
    }
  }

  handleAuctionUpdate(canvasId: number, auctionInfo: AuctionInfo): void {
    this.auctions.set(canvasId, auctionInfo);

    // Write-through
    this.supabase.upsertAuction(canvasId, auctionInfo).catch((err) =>
      this.logger.error(`Supabase auction upsert failed: ${err.message}`),
    );
  }

  getAuctionInfo(canvasId: number): AuctionInfo | undefined {
    return this.auctions.get(canvasId);
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  setSyncing(val: boolean): void {
    this.syncing = val;
  }

  getActiveCanvasCount(): number {
    let count = 0;
    for (const canvas of this.canvases.values()) {
      if (canvas.state === 'active') {
        count++;
      }
    }
    return count;
  }

  // --- Pixel history, leaderboard, stats, thumbnail ---

  handlePixelPainted(
    canvasId: number,
    x: number,
    y: number,
    colorIndex: number,
    painter: string,
    timestamp: number,
  ): void {
    // Append to pixel history
    let history = this.pixelHistory.get(canvasId);
    if (!history) {
      history = [];
      this.pixelHistory.set(canvasId, history);
    }
    history.push({ x, y, colorIndex, painter, timestamp });

    // Increment painter stats (lowercase for dedup)
    const key = painter.toLowerCase();
    this.painterStats.set(key, (this.painterStats.get(key) || 0) + 1);

    // Invalidate thumbnail cache
    this.thumbnailCache.delete(canvasId);

    // Buffer pixel history for batched Supabase write
    this.historyBuffer.push({ canvasId, x, y, colorIndex, painter, timestamp });
    if (this.historyBuffer.length >= CanvasService.FLUSH_THRESHOLD) {
      this.flushHistoryBuffer();
    }

    // Write-through: painter stats
    this.supabase.incrementPainterStat(painter).catch((err) =>
      this.logger.error(`Supabase painter stat failed: ${err.message}`),
    );
  }

  /** Restore in-memory Maps from Supabase data (called by ChainRecoveryService) */
  restoreFromDb(
    canvases: CanvasState[],
    auctions: AuctionInfo[],
    painterStats: Map<string, number>,
  ): void {
    for (const canvas of canvases) {
      this.canvases.set(canvas.canvasId, canvas);
    }
    for (const auction of auctions) {
      this.auctions.set(auction.canvasId, auction);
    }
    this.painterStats = painterStats;
    this.logger.log(
      `Restored from DB: ${canvases.length} canvases, ${auctions.length} auctions, ${painterStats.size} painters`,
    );
  }

  getPixelHistory(canvasId: number): PixelHistoryEntry[] {
    return this.pixelHistory.get(canvasId) || [];
  }

  getLeaderboard(limit = 100): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];
    for (const [address, pixelCount] of this.painterStats) {
      entries.push({ address, pixelCount });
    }
    entries.sort((a, b) => b.pixelCount - a.pixelCount);
    return entries.slice(0, limit);
  }

  getPlatformStats(): {
    totalCanvases: number;
    totalPixels: number;
    activeArtists: number;
  } {
    let totalPixels = 0;
    for (const canvas of this.canvases.values()) {
      totalPixels += canvas.filledPixels;
    }
    return {
      totalCanvases: this.canvases.size,
      totalPixels,
      activeArtists: this.painterStats.size,
    };
  }

  generateThumbnail(
    canvasId: number,
  ): { width: number; height: number; pixels: number[] } | null {
    // Check cache first
    const cached = this.thumbnailCache.get(canvasId);
    if (cached) return cached;

    // Get canvas state
    const canvas = this.canvases.get(canvasId);
    if (!canvas) return null;

    // Return raw pixel data for frontend canvas rendering
    const result = {
      width: canvas.width,
      height: canvas.height,
      pixels: Array.from(canvas.pixels),
    };

    // Cache the result
    this.thumbnailCache.set(canvasId, result);
    return result;
  }

  private flushHistoryBuffer(): void {
    if (this.historyBuffer.length === 0) return;
    const batch = this.historyBuffer.splice(0);
    this.supabase.insertPixelHistoryBatch(batch).catch((err) =>
      this.logger.error(
        `Supabase history batch insert failed: ${err.message}`,
      ),
    );
  }
}
