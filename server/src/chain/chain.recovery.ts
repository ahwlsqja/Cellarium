import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { CanvasService } from '../canvas/canvas.service';
import { ChainService } from './chain.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  PixelCanvasABI,
  CanvasAuctionABI,
  RevenueDistributorABI,
} from '../shared/abis/index';

const BATCH_SIZE = 5000n;
const BATCH_DELAY_MS = 100;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LAST_BLOCK_FILE = path.join(DATA_DIR, 'last-block.json');

@Injectable()
export class ChainRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(ChainRecoveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly canvasService: CanvasService,
    private readonly chainService: ChainService,
    private readonly supabase: SupabaseService,
  ) {}

  async onModuleInit() {
    // Run recovery in background -- do NOT block NestJS startup
    this.recover().catch((err) => {
      this.logger.error(`Recovery failed: ${err.message}`);
      this.canvasService.setSyncing(false);
    });
  }

  /**
   * Main recovery flow:
   * 1. Try loading state from Supabase
   * 2. Then do incremental chain scan from last_block onwards
   */
  private async recover(): Promise<void> {
    this.canvasService.setSyncing(true);

    if (this.supabase.enabled) {
      const restored = await this.restoreFromSupabase();
      if (restored) {
        // Incremental scan from last_block stored in Supabase
        await this.rebuildFromChain();
        return;
      }
    }

    // Fallback: full chain rebuild (no Supabase data)
    await this.rebuildFromChain();
  }

  /**
   * Load canvases, auctions, painter stats from Supabase into memory.
   * Returns true if any data was restored.
   */
  private async restoreFromSupabase(): Promise<boolean> {
    this.logger.log('Attempting to restore state from Supabase...');

    try {
      const [canvases, auctions, painterStats] = await Promise.all([
        this.supabase.getAllCanvases(),
        this.supabase.getAllAuctions(),
        this.supabase.getAllPainterStats(),
      ]);

      if (canvases.length === 0) {
        this.logger.log('No canvases found in Supabase, falling back to chain rebuild');
        return false;
      }

      this.canvasService.restoreFromDb(canvases, auctions, painterStats);

      // Restore auctionToCanvas reverse map
      const auctionToCanvas = this.chainService.getAuctionToCanvasMap();
      for (const auction of auctions) {
        auctionToCanvas.set(auction.auctionId, auction.canvasId);
      }

      this.logger.log(
        `Restored from Supabase: ${canvases.length} canvases, ${auctions.length} auctions, ${painterStats.size} painters`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to restore from Supabase: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async rebuildFromChain(): Promise<void> {
    this.canvasService.setSyncing(true);
    this.logger.log('Starting chain state recovery...');

    const client = this.chainService.getClient();
    const startBlock = BigInt(await this.getLastBlockAsync());
    let latestBlock: bigint;

    try {
      latestBlock = await client.getBlockNumber();
    } catch (err) {
      this.logger.error(
        `Failed to get latest block number: ${(err as Error).message}`,
      );
      this.canvasService.setSyncing(false);
      return;
    }

    this.logger.log(
      `Scanning from block ${startBlock} to ${latestBlock} (${latestBlock - startBlock} blocks)`,
    );

    const pixelCanvasAddress = this.configService.get<string>(
      'app.pixelCanvasAddress',
    );
    const canvasAuctionAddress = this.configService.get<string>(
      'app.canvasAuctionAddress',
    );
    const revenueDistributorAddress = this.configService.get<string>(
      'app.revenueDistributorAddress',
    );

    // 1. Scan CanvasCreated events first
    if (pixelCanvasAddress) {
      await this.scanEvents(
        pixelCanvasAddress as `0x${string}`,
        PixelCanvasABI,
        'CanvasCreated',
        startBlock,
        latestBlock,
        (log) => {
          const args = log.args as {
            canvasId?: bigint;
            proposer?: string;
            width?: number;
            height?: number;
            title?: string;
          };
          if (args.canvasId === undefined) return;
          const width = args.width || 0;
          const height = args.height || 0;
          this.canvasService.handleCanvasCreated(
            Number(args.canvasId),
            {
              proposer: args.proposer || '',
              title: args.title || '',
              width,
              height,
              totalPixels: width * height,
            },
          );
        },
      );

      // 1.5. Scan PixelPainted events (after canvases created, before state changes)
      await this.scanEvents(
        pixelCanvasAddress as `0x${string}`,
        PixelCanvasABI,
        'PixelPainted',
        startBlock,
        latestBlock,
        (log) => {
          const args = log.args as {
            canvasId?: bigint;
            painter?: string;
            x?: number;
            y?: number;
            colorIndex?: number;
            filledPixels?: bigint;
          };
          if (args.canvasId === undefined) return;
          const canvasId = Number(args.canvasId);
          // Update pixel in canvas state
          const canvas = this.canvasService.getCanvasState(canvasId);
          if (
            canvas &&
            args.x !== undefined &&
            args.y !== undefined &&
            args.colorIndex !== undefined
          ) {
            const linearIndex = args.y * canvas.width + args.x;
            if (canvas.pixels[linearIndex] === 0) canvas.filledPixels++;
            canvas.pixels[linearIndex] = args.colorIndex;
          }
          // Record in history
          this.canvasService.handlePixelPainted(
            canvasId,
            args.x ?? 0,
            args.y ?? 0,
            args.colorIndex ?? 0,
            args.painter ?? '',
            0, // chain recovery has no reliable timestamp per pixel, use 0
          );
        },
      );

      // 2. Scan CanvasCompleted
      await this.scanEvents(
        pixelCanvasAddress as `0x${string}`,
        PixelCanvasABI,
        'CanvasCompleted',
        startBlock,
        latestBlock,
        (log) => {
          const args = log.args as {
            canvasId?: bigint;
            timestamp?: bigint;
          };
          if (args.canvasId === undefined) return;
          this.canvasService.handleCanvasStateChange(
            Number(args.canvasId),
            'completed',
          );
        },
      );
    }

    // 3. Scan AuctionStarted
    if (canvasAuctionAddress) {
      const auctionToCanvas = this.chainService.getAuctionToCanvasMap();

      await this.scanEvents(
        canvasAuctionAddress as `0x${string}`,
        CanvasAuctionABI,
        'AuctionStarted',
        startBlock,
        latestBlock,
        (log) => {
          const args = log.args as {
            canvasId?: bigint;
            auctionId?: bigint;
            startPrice?: bigint;
            endTime?: bigint;
          };
          if (
            args.canvasId === undefined ||
            args.auctionId === undefined
          )
            return;
          const canvasId = Number(args.canvasId);
          const auctionId = Number(args.auctionId);

          auctionToCanvas.set(auctionId, canvasId);
          this.canvasService.handleCanvasStateChange(
            canvasId,
            'auctioning',
          );
          this.canvasService.handleAuctionUpdate(canvasId, {
            auctionId,
            canvasId,
            startPrice: args.startPrice || BigInt(0),
            endTime: args.endTime ? Number(args.endTime) : 0,
            highestBid: BigInt(0),
            highestBidder: '',
            settled: false,
          });
        },
      );

      // 4. Scan BidPlaced
      await this.scanEvents(
        canvasAuctionAddress as `0x${string}`,
        CanvasAuctionABI,
        'BidPlaced',
        startBlock,
        latestBlock,
        (log) => {
          const args = log.args as {
            auctionId?: bigint;
            bidder?: string;
            amount?: bigint;
          };
          if (args.auctionId === undefined) return;
          const auctionId = Number(args.auctionId);
          const canvasId = auctionToCanvas.get(auctionId);
          if (canvasId === undefined) return;

          const existing =
            this.canvasService.getAuctionInfo(canvasId);
          if (existing) {
            this.canvasService.handleAuctionUpdate(canvasId, {
              ...existing,
              highestBid: args.amount || BigInt(0),
              highestBidder: args.bidder || '',
            });
          }
        },
      );

      // 5. Scan AuctionSettled
      await this.scanEvents(
        canvasAuctionAddress as `0x${string}`,
        CanvasAuctionABI,
        'AuctionSettled',
        startBlock,
        latestBlock,
        (log) => {
          const args = log.args as {
            auctionId?: bigint;
            winner?: string;
            amount?: bigint;
          };
          if (args.auctionId === undefined) return;
          const auctionId = Number(args.auctionId);
          const canvasId = auctionToCanvas.get(auctionId);
          if (canvasId === undefined) return;

          this.canvasService.handleCanvasStateChange(
            canvasId,
            'settled',
          );
          const existing =
            this.canvasService.getAuctionInfo(canvasId);
          if (existing) {
            this.canvasService.handleAuctionUpdate(canvasId, {
              ...existing,
              settled: true,
            });
          }
        },
      );
    }

    // 6. Scan RevenueDistributed (informational only -- no state change)
    if (revenueDistributorAddress) {
      await this.scanEvents(
        revenueDistributorAddress as `0x${string}`,
        RevenueDistributorABI,
        'RevenueDistributed',
        startBlock,
        latestBlock,
        (_log) => {
          // Informational only during recovery -- no action needed
        },
      );
    }

    // Save last block for next restart (prefer Supabase, fallback to file)
    await this.saveLastBlockAsync(Number(latestBlock));

    this.canvasService.setSyncing(false);
    this.logger.log(
      `Chain recovery complete. ${this.canvasService.getAllCanvases().length} canvases loaded.`,
    );
  }

  private async scanEvents(
    address: `0x${string}`,
    abi: readonly Record<string, unknown>[],
    eventName: string,
    fromBlock: bigint,
    toBlock: bigint,
    handler: (log: { args: Record<string, unknown> }) => void,
  ): Promise<void> {
    const client = this.chainService.getClient();
    let scanned = 0;

    for (
      let from = fromBlock;
      from <= toBlock;
      from += BATCH_SIZE
    ) {
      const to =
        from + BATCH_SIZE - 1n > toBlock
          ? toBlock
          : from + BATCH_SIZE - 1n;

      try {
        const logs = await client.getLogs({
          address,
          event: (abi as readonly { name: string }[]).find(
            (e) => e.name === eventName,
          ) as any,
          fromBlock: from,
          toBlock: to,
        });

        for (const log of logs) {
          handler(log as { args: Record<string, unknown> });
        }
        scanned += logs.length;
      } catch (err) {
        this.logger.warn(
          `Error scanning ${eventName} blocks ${from}-${to}: ${(err as Error).message}`,
        );
      }

      // Yield to event loop between batches (Pitfall 6)
      await new Promise<void>((resolve) => setImmediate(resolve));

      // Delay between batches to avoid rate limits (Pitfall 2)
      if (from + BATCH_SIZE <= toBlock) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, BATCH_DELAY_MS),
        );
      }
    }

    if (scanned > 0) {
      this.logger.log(`Scanned ${scanned} ${eventName} events`);
    }
  }

  /**
   * Get last block: try Supabase first, then file fallback, then deployment block.
   */
  private async getLastBlockAsync(): Promise<number> {
    if (this.supabase.enabled) {
      const dbBlock = await this.supabase.getLastBlock();
      if (dbBlock !== null) {
        this.logger.log(`Last block from Supabase: ${dbBlock}`);
        return dbBlock;
      }
    }
    return this.getLastBlock();
  }

  /**
   * Save last block: write to both Supabase and file.
   */
  private async saveLastBlockAsync(blockNumber: number): Promise<void> {
    if (this.supabase.enabled) {
      await this.supabase.saveLastBlock(blockNumber).catch((err) =>
        this.logger.error(`Supabase saveLastBlock failed: ${(err as Error).message}`),
      );
    }
    this.saveLastBlock(blockNumber);
  }

  getLastBlock(): number {
    try {
      const data = fs.readFileSync(LAST_BLOCK_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.lastBlock || this.getDeploymentBlock();
    } catch {
      return this.getDeploymentBlock();
    }
  }

  saveLastBlock(blockNumber: number): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(
        LAST_BLOCK_FILE,
        JSON.stringify({ lastBlock: blockNumber }, null, 2),
      );
    } catch (err) {
      this.logger.error(
        `Failed to save last block: ${(err as Error).message}`,
      );
    }
  }

  private getDeploymentBlock(): number {
    return (
      this.configService.get<number>('app.deploymentBlock') || 0
    );
  }
}
