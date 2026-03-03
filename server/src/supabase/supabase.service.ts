import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CanvasState,
  AuctionInfo,
  PixelHistoryEntry,
} from '../canvas/canvas.types';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;
  private _enabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('app.supabaseUrl');
    const key = this.configService.get<string>('app.supabaseKey');

    if (!url || !key) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_KEY not set — running without persistence',
      );
      return;
    }

    this.client = createClient(url, key);
    this._enabled = true;
    this.logger.log('Supabase client initialized');
  }

  get enabled(): boolean {
    return this._enabled;
  }

  // ─── Canvas CRUD ──────────────────────────────────────────────

  async upsertCanvas(canvas: CanvasState): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('canvases').upsert(
      {
        canvas_id: canvas.canvasId,
        proposer: canvas.proposer,
        title: canvas.title,
        description: canvas.description,
        width: canvas.width,
        height: canvas.height,
        total_pixels: canvas.totalPixels,
        filled_pixels: canvas.filledPixels,
        pixels: Array.from(canvas.pixels),
        state: canvas.state,
        cooldown_seconds: canvas.cooldownSeconds,
        auction_start_price: canvas.auctionStartPrice.toString(),
        auction_duration: canvas.auctionDuration,
        created_at: canvas.createdAt,
      },
      { onConflict: 'canvas_id' },
    );
    if (error) {
      this.logger.error(`upsertCanvas(${canvas.canvasId}): ${error.message}`);
    }
  }

  async getCanvas(canvasId: number): Promise<CanvasState | null> {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('canvases')
      .select('*')
      .eq('canvas_id', canvasId)
      .single();

    if (error || !data) return null;
    return this.rowToCanvasState(data);
  }

  async getAllCanvases(): Promise<CanvasState[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('canvases')
      .select('*')
      .order('canvas_id', { ascending: true });

    if (error || !data) {
      if (error) this.logger.error(`getAllCanvases: ${error.message}`);
      return [];
    }
    return data.map((row) => this.rowToCanvasState(row));
  }

  async updateCanvasPixels(
    canvasId: number,
    pixels: Uint8Array,
    filledPixels: number,
  ): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client
      .from('canvases')
      .update({
        pixels: Array.from(pixels),
        filled_pixels: filledPixels,
      })
      .eq('canvas_id', canvasId);

    if (error) {
      this.logger.error(
        `updateCanvasPixels(${canvasId}): ${error.message}`,
      );
    }
  }

  async updateCanvasState(
    canvasId: number,
    state: CanvasState['state'],
  ): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client
      .from('canvases')
      .update({ state })
      .eq('canvas_id', canvasId);

    if (error) {
      this.logger.error(
        `updateCanvasState(${canvasId}): ${error.message}`,
      );
    }
  }

  // ─── Pixel History ────────────────────────────────────────────

  async insertPixelHistory(entry: PixelHistoryEntry & { canvasId: number }): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('pixel_history').insert({
      canvas_id: entry.canvasId,
      x: entry.x,
      y: entry.y,
      color_index: entry.colorIndex,
      painter: entry.painter,
      timestamp: entry.timestamp,
    });
    if (error) {
      this.logger.error(`insertPixelHistory: ${error.message}`);
    }
  }

  async insertPixelHistoryBatch(
    entries: (PixelHistoryEntry & { canvasId: number })[],
  ): Promise<void> {
    if (!this.client || entries.length === 0) return;
    const rows = entries.map((e) => ({
      canvas_id: e.canvasId,
      x: e.x,
      y: e.y,
      color_index: e.colorIndex,
      painter: e.painter,
      timestamp: e.timestamp,
    }));

    const { error } = await this.client.from('pixel_history').insert(rows);
    if (error) {
      this.logger.error(
        `insertPixelHistoryBatch(${entries.length}): ${error.message}`,
      );
    }
  }

  async getPixelHistory(canvasId: number): Promise<PixelHistoryEntry[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('pixel_history')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('id', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => ({
      x: row.x,
      y: row.y,
      colorIndex: row.color_index,
      painter: row.painter,
      timestamp: Number(row.timestamp),
    }));
  }

  // ─── Auction ──────────────────────────────────────────────────

  async upsertAuction(canvasId: number, auction: AuctionInfo): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('auctions').upsert(
      {
        canvas_id: canvasId,
        auction_id: auction.auctionId,
        start_price: auction.startPrice.toString(),
        end_time: auction.endTime,
        highest_bid: auction.highestBid.toString(),
        highest_bidder: auction.highestBidder,
        settled: auction.settled,
      },
      { onConflict: 'canvas_id' },
    );
    if (error) {
      this.logger.error(`upsertAuction(${canvasId}): ${error.message}`);
    }
  }

  async getAllAuctions(): Promise<AuctionInfo[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('auctions')
      .select('*');

    if (error || !data) return [];
    return data.map((row) => ({
      auctionId: row.auction_id,
      canvasId: row.canvas_id,
      startPrice: BigInt(row.start_price || '0'),
      endTime: row.end_time,
      highestBid: BigInt(row.highest_bid || '0'),
      highestBidder: row.highest_bidder,
      settled: row.settled,
    }));
  }

  // ─── Painter Stats ────────────────────────────────────────────

  async incrementPainterStat(address: string): Promise<void> {
    if (!this.client) return;
    const key = address.toLowerCase();

    // Upsert: insert or increment
    const { error } = await this.client.rpc('increment_painter_stat', {
      p_address: key,
    });

    // If RPC doesn't exist, fallback to manual upsert
    if (error) {
      const { data: existing } = await this.client
        .from('painter_stats')
        .select('pixel_count')
        .eq('address', key)
        .single();

      if (existing) {
        await this.client
          .from('painter_stats')
          .update({ pixel_count: existing.pixel_count + 1 })
          .eq('address', key);
      } else {
        await this.client
          .from('painter_stats')
          .insert({ address: key, pixel_count: 1 });
      }
    }
  }

  async getAllPainterStats(): Promise<Map<string, number>> {
    if (!this.client) return new Map();
    const { data, error } = await this.client
      .from('painter_stats')
      .select('*');

    if (error || !data) return new Map();
    const map = new Map<string, number>();
    for (const row of data) {
      map.set(row.address, row.pixel_count);
    }
    return map;
  }

  // ─── Chain State ──────────────────────────────────────────────

  async getLastBlock(): Promise<number | null> {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('chain_state')
      .select('value')
      .eq('key', 'last_block')
      .single();

    if (error || !data) return null;
    return parseInt(data.value, 10);
  }

  async saveLastBlock(blockNumber: number): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('chain_state').upsert(
      { key: 'last_block', value: blockNumber.toString() },
      { onConflict: 'key' },
    );
    if (error) {
      this.logger.error(`saveLastBlock: ${error.message}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private rowToCanvasState(row: Record<string, unknown>): CanvasState {
    const pixelsData = row.pixels as number[];
    return {
      canvasId: row.canvas_id as number,
      proposer: (row.proposer as string) || '',
      title: (row.title as string) || '',
      description: (row.description as string) || '',
      width: row.width as number,
      height: row.height as number,
      totalPixels: row.total_pixels as number,
      filledPixels: row.filled_pixels as number,
      pixels: new Uint8Array(pixelsData),
      state: (row.state as CanvasState['state']) || 'active',
      cooldownSeconds: (row.cooldown_seconds as number) || 0,
      auctionStartPrice: BigInt((row.auction_start_price as string) || '0'),
      auctionDuration: (row.auction_duration as number) || 0,
      createdAt: (row.created_at as number) || 0,
    };
  }
}
