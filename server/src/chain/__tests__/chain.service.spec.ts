import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainService } from '../chain.service';
import { CanvasService } from '../../canvas/canvas.service';
import { CanvasGateway } from '../../canvas/canvas.gateway';

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    watchContractEvent: vi.fn(() => vi.fn()), // returns unwatch fn
    getBlockNumber: vi.fn(async () => 1000n),
    getLogs: vi.fn(async () => []),
  })),
  http: vi.fn(() => 'http-transport'),
}));

function createMockCanvasService(): CanvasService {
  return {
    handleCanvasCreated: vi.fn(),
    handleCanvasStateChange: vi.fn(),
    handleAuctionUpdate: vi.fn(),
    handlePixelPainted: vi.fn(),
    getAuctionInfo: vi.fn(),
    getAllCanvases: vi.fn(() => []),
    setSyncing: vi.fn(),
    isSyncing: vi.fn(() => false),
  } as unknown as CanvasService;
}

function createMockCanvasGateway(): CanvasGateway {
  return {
    server: {
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() })),
    },
  } as unknown as CanvasGateway;
}

function createMockConfigService() {
  const config: Record<string, string | number> = {
    'app.rpcUrl': 'https://seoul.worldland.foundation',
    'app.pixelCanvasAddress': '0x1111111111111111111111111111111111111111',
    'app.canvasAuctionAddress':
      '0x2222222222222222222222222222222222222222',
    'app.revenueDistributorAddress':
      '0x3333333333333333333333333333333333333333',
    'app.deploymentBlock': 0,
  };
  return {
    get: vi.fn((key: string) => config[key]),
  };
}

describe('ChainService', () => {
  let service: ChainService;
  let canvasService: CanvasService;
  let canvasGateway: CanvasGateway;
  let configService: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    canvasService = createMockCanvasService();
    canvasGateway = createMockCanvasGateway();
    configService = createMockConfigService();

    service = new ChainService(
      configService as any,
      canvasService,
      canvasGateway,
    );
  });

  describe('constructor', () => {
    it('should create a viem public client', () => {
      expect(service.getClient()).toBeDefined();
    });
  });

  describe('startEventWatching', () => {
    it('should create watchers for all event types', () => {
      const client = service.getClient();
      const watchSpy = vi.spyOn(client, 'watchContractEvent' as any);

      service.startEventWatching();

      // CanvasCreated, CanvasCompleted, PixelPainted, AuctionStarted, BidPlaced,
      // AuctionExtended, AuctionSettled, RevenueDistributed = 8 watchers
      expect(watchSpy).toHaveBeenCalledTimes(8);
    });

    it('should not create watchers when addresses are empty', () => {
      const emptyConfig = {
        get: vi.fn(() => ''),
      };
      const svc = new ChainService(
        emptyConfig as any,
        canvasService,
        canvasGateway,
      );
      const client = svc.getClient();
      const watchSpy = vi.spyOn(client, 'watchContractEvent' as any);

      svc.startEventWatching();
      expect(watchSpy).not.toHaveBeenCalled();
    });
  });

  describe('CanvasCreated handler', () => {
    it('should call canvasService.handleCanvasCreated and broadcast', () => {
      const client = service.getClient();
      let capturedHandler: ((logs: unknown[]) => void) | null = null;

      vi.spyOn(client, 'watchContractEvent' as any).mockImplementation(
        (opts: { eventName: string; onLogs: (logs: unknown[]) => void }) => {
          if (opts.eventName === 'CanvasCreated') {
            capturedHandler = opts.onLogs;
          }
          return vi.fn();
        },
      );

      service.startEventWatching();

      expect(capturedHandler).not.toBeNull();

      // Simulate a CanvasCreated log
      capturedHandler!([
        {
          args: {
            canvasId: 1n,
            proposer: '0xabc',
            width: 16,
            height: 16,
            title: 'Test',
          },
        },
      ]);

      expect(canvasService.handleCanvasCreated).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          proposer: '0xabc',
          title: 'Test',
          width: 16,
          height: 16,
          totalPixels: 256,
        }),
      );

      expect(canvasGateway.server.emit).toHaveBeenCalledWith(
        'canvasCreated',
        expect.objectContaining({
          canvasId: 1,
          proposer: '0xabc',
          width: 16,
          height: 16,
          title: 'Test',
        }),
      );
    });
  });

  describe('AuctionStarted handler', () => {
    it('should update canvas state, populate auctionToCanvas, and broadcast to room', () => {
      const client = service.getClient();
      let capturedHandler: ((logs: unknown[]) => void) | null = null;

      const mockToEmit = vi.fn();
      (canvasGateway.server.to as ReturnType<typeof vi.fn>).mockReturnValue({
        emit: mockToEmit,
      });

      vi.spyOn(client, 'watchContractEvent' as any).mockImplementation(
        (opts: { eventName: string; onLogs: (logs: unknown[]) => void }) => {
          if (opts.eventName === 'AuctionStarted') {
            capturedHandler = opts.onLogs;
          }
          return vi.fn();
        },
      );

      service.startEventWatching();
      expect(capturedHandler).not.toBeNull();

      capturedHandler!([
        {
          args: {
            canvasId: 5n,
            auctionId: 10n,
            startPrice: 1000000000000000000n,
            endTime: 1700000000n,
          },
        },
      ]);

      expect(
        canvasService.handleCanvasStateChange,
      ).toHaveBeenCalledWith(5, 'auctioning');
      expect(canvasService.handleAuctionUpdate).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          auctionId: 10,
          canvasId: 5,
          startPrice: 1000000000000000000n,
        }),
      );

      // Verify auctionToCanvas index was populated
      expect(service.getAuctionToCanvasMap().get(10)).toBe(5);

      expect(canvasGateway.server.to).toHaveBeenCalledWith(
        'canvas:5',
      );
      expect(mockToEmit).toHaveBeenCalledWith(
        'auctionStarted',
        expect.objectContaining({
          canvasId: 5,
          auctionId: 10,
        }),
      );
    });
  });

  describe('BidPlaced handler', () => {
    it('should resolve canvasId from auctionToCanvas and update auction', () => {
      const client = service.getClient();
      let auctionStartedHandler:
        | ((logs: unknown[]) => void)
        | null = null;
      let bidPlacedHandler:
        | ((logs: unknown[]) => void)
        | null = null;

      const mockToEmit = vi.fn();
      (canvasGateway.server.to as ReturnType<typeof vi.fn>).mockReturnValue({
        emit: mockToEmit,
      });

      vi.spyOn(client, 'watchContractEvent' as any).mockImplementation(
        (opts: { eventName: string; onLogs: (logs: unknown[]) => void }) => {
          if (opts.eventName === 'AuctionStarted') {
            auctionStartedHandler = opts.onLogs;
          }
          if (opts.eventName === 'BidPlaced') {
            bidPlacedHandler = opts.onLogs;
          }
          return vi.fn();
        },
      );

      // Provide existing auction info
      (canvasService.getAuctionInfo as ReturnType<typeof vi.fn>).mockReturnValue({
        auctionId: 10,
        canvasId: 5,
        startPrice: BigInt(1000),
        endTime: 1700000000,
        highestBid: BigInt(0),
        highestBidder: '',
        settled: false,
      });

      service.startEventWatching();

      // First: AuctionStarted to populate reverse index
      auctionStartedHandler!([
        {
          args: {
            canvasId: 5n,
            auctionId: 10n,
            startPrice: 1000n,
            endTime: 1700000000n,
          },
        },
      ]);

      // Then: BidPlaced
      bidPlacedHandler!([
        {
          args: {
            auctionId: 10n,
            bidder: '0xbidder',
            amount: 2000n,
          },
        },
      ]);

      // handleAuctionUpdate called for BidPlaced
      expect(
        canvasService.handleAuctionUpdate,
      ).toHaveBeenLastCalledWith(
        5,
        expect.objectContaining({
          highestBid: 2000n,
          highestBidder: '0xbidder',
        }),
      );

      expect(canvasGateway.server.to).toHaveBeenCalledWith(
        'canvas:5',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should call all unwatch functions', () => {
      const client = service.getClient();
      const unwatchFn1 = vi.fn();
      const unwatchFn2 = vi.fn();
      let callCount = 0;

      vi.spyOn(client, 'watchContractEvent' as any).mockImplementation(
        () => {
          callCount++;
          return callCount <= 1 ? unwatchFn1 : unwatchFn2;
        },
      );

      service.startEventWatching();
      service.onModuleDestroy();

      expect(unwatchFn1).toHaveBeenCalled();
      expect(unwatchFn2).toHaveBeenCalled();
    });
  });

  describe('AuctionSettled handler', () => {
    it('should set canvas state to settled', () => {
      const client = service.getClient();
      let auctionStartedHandler:
        | ((logs: unknown[]) => void)
        | null = null;
      let settledHandler:
        | ((logs: unknown[]) => void)
        | null = null;

      const mockToEmit = vi.fn();
      (canvasGateway.server.to as ReturnType<typeof vi.fn>).mockReturnValue({
        emit: mockToEmit,
      });

      vi.spyOn(client, 'watchContractEvent' as any).mockImplementation(
        (opts: { eventName: string; onLogs: (logs: unknown[]) => void }) => {
          if (opts.eventName === 'AuctionStarted') {
            auctionStartedHandler = opts.onLogs;
          }
          if (opts.eventName === 'AuctionSettled') {
            settledHandler = opts.onLogs;
          }
          return vi.fn();
        },
      );

      (canvasService.getAuctionInfo as ReturnType<typeof vi.fn>).mockReturnValue({
        auctionId: 10,
        canvasId: 5,
        startPrice: BigInt(1000),
        endTime: 1700000000,
        highestBid: BigInt(2000),
        highestBidder: '0xbidder',
        settled: false,
      });

      service.startEventWatching();

      // Populate reverse index
      auctionStartedHandler!([
        {
          args: {
            canvasId: 5n,
            auctionId: 10n,
            startPrice: 1000n,
            endTime: 1700000000n,
          },
        },
      ]);

      settledHandler!([
        {
          args: {
            auctionId: 10n,
            winner: '0xwinner',
            amount: 2000n,
          },
        },
      ]);

      expect(
        canvasService.handleCanvasStateChange,
      ).toHaveBeenCalledWith(5, 'settled');
    });
  });
});
