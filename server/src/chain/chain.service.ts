import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, PublicClient, WatchContractEventReturnType } from 'viem';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasGateway } from '../canvas/canvas.gateway';
import {
  PixelCanvasABI,
  CanvasAuctionABI,
  RevenueDistributorABI,
} from '../shared/abis/index';

@Injectable()
export class ChainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainService.name);
  private client: PublicClient;
  private unwatchFns: WatchContractEventReturnType[] = [];

  /**
   * Reverse index: auctionId -> canvasId.
   * BidPlaced / AuctionExtended / AuctionSettled only carry auctionId.
   * We populate this map when AuctionStarted arrives (which has both).
   */
  private auctionToCanvas = new Map<number, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly canvasService: CanvasService,
    private readonly canvasGateway: CanvasGateway,
  ) {
    const rpcUrl =
      this.configService.get<string>('app.rpcUrl') ||
      'https://seoul.worldland.foundation';

    this.client = createPublicClient({
      transport: http(rpcUrl),
      pollingInterval: 2_000,
    }) as PublicClient;
  }

  getClient(): PublicClient {
    return this.client;
  }

  getAuctionToCanvasMap(): Map<number, number> {
    return this.auctionToCanvas;
  }

  async onModuleInit() {
    // Start watching in background -- do NOT block NestJS startup
    this.startEventWatching();
    this.logger.log('Chain event watching started');
  }

  onModuleDestroy() {
    for (const unwatch of this.unwatchFns) {
      unwatch();
    }
    this.unwatchFns = [];
    this.logger.log('Chain event watchers cleaned up');
  }

  startEventWatching(): void {
    const pixelCanvasAddress = this.configService.get<string>(
      'app.pixelCanvasAddress',
    );
    const canvasAuctionAddress = this.configService.get<string>(
      'app.canvasAuctionAddress',
    );
    const revenueDistributorAddress = this.configService.get<string>(
      'app.revenueDistributorAddress',
    );

    // --- PixelCanvas events ---
    if (pixelCanvasAddress) {
      const addr = pixelCanvasAddress as `0x${string}`;

      // CanvasCreated
      const unwatchCreated = this.client.watchContractEvent({
        address: addr,
        abi: PixelCanvasABI,
        eventName: 'CanvasCreated',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              canvasId?: bigint;
              proposer?: string;
              width?: number;
              height?: number;
              title?: string;
            };
            if (args.canvasId === undefined) continue;
            const canvasId = Number(args.canvasId);
            const width = args.width || 0;
            const height = args.height || 0;

            this.canvasService.handleCanvasCreated(canvasId, {
              proposer: args.proposer || '',
              title: args.title || '',
              width,
              height,
              totalPixels: width * height,
            });

            this.canvasGateway.server.emit('canvasCreated', {
              canvasId,
              proposer: args.proposer,
              width,
              height,
              title: args.title,
            });

            this.logger.log(`CanvasCreated: canvasId=${canvasId}`);
          }
        },
      });
      this.unwatchFns.push(unwatchCreated);

      // CanvasCompleted
      const unwatchCompleted = this.client.watchContractEvent({
        address: addr,
        abi: PixelCanvasABI,
        eventName: 'CanvasCompleted',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              canvasId?: bigint;
              timestamp?: bigint;
            };
            if (args.canvasId === undefined) continue;
            const canvasId = Number(args.canvasId);

            this.canvasService.handleCanvasStateChange(canvasId, 'completed');
            this.canvasGateway.server
              .to(`canvas:${canvasId}`)
              .emit('canvasCompleted', {
                canvasId,
                timestamp: args.timestamp
                  ? Number(args.timestamp)
                  : Date.now(),
              });

            this.logger.log(`CanvasCompleted: canvasId=${canvasId}`);
          }
        },
      });
      this.unwatchFns.push(unwatchCompleted);

      // PixelPainted -- update canvas state, record history, broadcast to clients
      const unwatchPixelPainted = this.client.watchContractEvent({
        address: addr,
        abi: PixelCanvasABI,
        eventName: 'PixelPainted',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              canvasId?: bigint;
              painter?: string;
              x?: number;
              y?: number;
              colorIndex?: number;
              filledPixels?: bigint;
            };
            if (args.canvasId === undefined) continue;
            const canvasId = Number(args.canvasId);
            const x = args.x ?? 0;
            const y = args.y ?? 0;
            const colorIndex = args.colorIndex ?? 0;
            const painter = args.painter ?? '';

            // Update in-memory canvas pixel data
            const result = this.canvasService.paintPixel(
              canvasId,
              x,
              y,
              colorIndex,
              painter,
            );

            // Broadcast to all clients in the canvas room
            if (result.success) {
              const payload = {
                canvasId,
                x,
                y,
                colorIndex,
                painter,
              };
              this.canvasGateway.server
                .to(`canvas:${canvasId}`)
                .emit('pixelPainted', payload);
            }

            this.logger.log(
              `PixelPainted: canvasId=${canvasId}, (${x},${y})=${colorIndex}, painter=${painter}`,
            );
          }
        },
      });
      this.unwatchFns.push(unwatchPixelPainted);
    }

    // --- CanvasAuction events ---
    if (canvasAuctionAddress) {
      const addr = canvasAuctionAddress as `0x${string}`;

      // AuctionStarted
      const unwatchAuctionStarted = this.client.watchContractEvent({
        address: addr,
        abi: CanvasAuctionABI,
        eventName: 'AuctionStarted',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
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
              continue;

            const canvasId = Number(args.canvasId);
            const auctionId = Number(args.auctionId);

            // Populate reverse index
            this.auctionToCanvas.set(auctionId, canvasId);

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

            this.canvasGateway.server
              .to(`canvas:${canvasId}`)
              .emit('auctionStarted', {
                canvasId,
                auctionId,
                startPrice: (args.startPrice || BigInt(0)).toString(),
                endTime: args.endTime ? Number(args.endTime) : 0,
              });

            this.logger.log(
              `AuctionStarted: canvasId=${canvasId}, auctionId=${auctionId}`,
            );
          }
        },
      });
      this.unwatchFns.push(unwatchAuctionStarted);

      // BidPlaced
      const unwatchBidPlaced = this.client.watchContractEvent({
        address: addr,
        abi: CanvasAuctionABI,
        eventName: 'BidPlaced',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              auctionId?: bigint;
              bidder?: string;
              amount?: bigint;
            };
            if (args.auctionId === undefined) continue;

            const auctionId = Number(args.auctionId);
            const canvasId = this.auctionToCanvas.get(auctionId);

            if (canvasId !== undefined) {
              const existing =
                this.canvasService.getAuctionInfo(canvasId);
              if (existing) {
                this.canvasService.handleAuctionUpdate(canvasId, {
                  ...existing,
                  highestBid: args.amount || BigInt(0),
                  highestBidder: args.bidder || '',
                });
              }

              this.canvasGateway.server
                .to(`canvas:${canvasId}`)
                .emit('bidPlaced', {
                  canvasId,
                  auctionId,
                  bidder: args.bidder,
                  amount: (args.amount || BigInt(0)).toString(),
                });
            }

            this.logger.log(
              `BidPlaced: auctionId=${auctionId}, bidder=${args.bidder}`,
            );
          }
        },
      });
      this.unwatchFns.push(unwatchBidPlaced);

      // AuctionExtended
      const unwatchExtended = this.client.watchContractEvent({
        address: addr,
        abi: CanvasAuctionABI,
        eventName: 'AuctionExtended',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              auctionId?: bigint;
              newEndTime?: bigint;
            };
            if (args.auctionId === undefined) continue;

            const auctionId = Number(args.auctionId);
            const canvasId = this.auctionToCanvas.get(auctionId);

            if (canvasId !== undefined) {
              const existing =
                this.canvasService.getAuctionInfo(canvasId);
              if (existing) {
                this.canvasService.handleAuctionUpdate(canvasId, {
                  ...existing,
                  endTime: args.newEndTime
                    ? Number(args.newEndTime)
                    : existing.endTime,
                });
              }

              this.canvasGateway.server
                .to(`canvas:${canvasId}`)
                .emit('auctionExtended', {
                  canvasId,
                  auctionId,
                  newEndTime: args.newEndTime
                    ? Number(args.newEndTime)
                    : 0,
                });
            }

            this.logger.log(`AuctionExtended: auctionId=${auctionId}`);
          }
        },
      });
      this.unwatchFns.push(unwatchExtended);

      // AuctionSettled
      const unwatchSettled = this.client.watchContractEvent({
        address: addr,
        abi: CanvasAuctionABI,
        eventName: 'AuctionSettled',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              auctionId?: bigint;
              winner?: string;
              amount?: bigint;
            };
            if (args.auctionId === undefined) continue;

            const auctionId = Number(args.auctionId);
            const canvasId = this.auctionToCanvas.get(auctionId);

            if (canvasId !== undefined) {
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

              this.canvasGateway.server
                .to(`canvas:${canvasId}`)
                .emit('auctionSettled', {
                  canvasId,
                  auctionId,
                  winner: args.winner,
                  amount: (args.amount || BigInt(0)).toString(),
                });
            }

            this.logger.log(`AuctionSettled: auctionId=${auctionId}`);
          }
        },
      });
      this.unwatchFns.push(unwatchSettled);
    }

    // --- RevenueDistributor events ---
    if (revenueDistributorAddress) {
      const addr = revenueDistributorAddress as `0x${string}`;

      const unwatchRevenue = this.client.watchContractEvent({
        address: addr,
        abi: RevenueDistributorABI,
        eventName: 'RevenueDistributed',
        pollingInterval: 2_000,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = log.args as {
              canvasId?: bigint;
              totalAmount?: bigint;
              contributorsShare?: bigint;
              proposerShare?: bigint;
              platformShare?: bigint;
            };
            if (args.canvasId === undefined) continue;

            const canvasId = Number(args.canvasId);

            this.canvasGateway.server
              .to(`canvas:${canvasId}`)
              .emit('revenueDistributed', {
                canvasId,
                totalAmount: (
                  args.totalAmount || BigInt(0)
                ).toString(),
                contributorsShare: (
                  args.contributorsShare || BigInt(0)
                ).toString(),
                proposerShare: (
                  args.proposerShare || BigInt(0)
                ).toString(),
                platformShare: (
                  args.platformShare || BigInt(0)
                ).toString(),
              });

            this.logger.log(
              `RevenueDistributed: canvasId=${canvasId}`,
            );
          }
        },
      });
      this.unwatchFns.push(unwatchRevenue);
    }
  }
}
