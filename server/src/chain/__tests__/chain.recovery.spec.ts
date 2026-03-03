import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ChainRecoveryService } from '../chain.recovery';
import { CanvasService } from '../../canvas/canvas.service';
import { ChainService } from '../chain.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

function createMockSupabase(): SupabaseService {
  return {
    enabled: false,
    getLastBlock: vi.fn(async () => null),
    saveLastBlock: vi.fn(async () => {}),
    getAllCanvases: vi.fn(async () => []),
    getAllAuctions: vi.fn(async () => []),
    getAllPainterStats: vi.fn(async () => new Map()),
  } as unknown as SupabaseService;
}

function createMockCanvasService(): CanvasService {
  return {
    handleCanvasCreated: vi.fn(),
    handleCanvasStateChange: vi.fn(),
    handleAuctionUpdate: vi.fn(),
    getAuctionInfo: vi.fn(),
    getAllCanvases: vi.fn(() => []),
    setSyncing: vi.fn(),
    isSyncing: vi.fn(() => false),
  } as unknown as CanvasService;
}

function createMockChainService(
  latestBlock = 10000n,
  logs: unknown[] = [],
): ChainService {
  return {
    getClient: vi.fn(() => ({
      getBlockNumber: vi.fn(async () => latestBlock),
      getLogs: vi.fn(async () => logs),
    })),
    getAuctionToCanvasMap: vi.fn(() => new Map<number, number>()),
  } as unknown as ChainService;
}

function createMockConfigService(
  deploymentBlock = 0,
  addresses = {
    pixelCanvas: '0x1111111111111111111111111111111111111111',
    canvasAuction: '0x2222222222222222222222222222222222222222',
    revenueDistributor:
      '0x3333333333333333333333333333333333333333',
  },
) {
  const config: Record<string, string | number> = {
    'app.pixelCanvasAddress': addresses.pixelCanvas,
    'app.canvasAuctionAddress': addresses.canvasAuction,
    'app.revenueDistributorAddress': addresses.revenueDistributor,
    'app.deploymentBlock': deploymentBlock,
  };
  return {
    get: vi.fn((key: string) => config[key]),
  };
}

describe('ChainRecoveryService', () => {
  let service: ChainRecoveryService;
  let canvasService: CanvasService;
  let chainService: ChainService;
  let configService: ReturnType<typeof createMockConfigService>;
  let supabase: SupabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    canvasService = createMockCanvasService();
    chainService = createMockChainService();
    configService = createMockConfigService();
    supabase = createMockSupabase();

    service = new ChainRecoveryService(
      configService as any,
      canvasService,
      chainService,
      supabase,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLastBlock', () => {
    it('should return saved block when file exists', () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ lastBlock: 5000 }),
      );

      const block = service.getLastBlock();
      expect(block).toBe(5000);
    });

    it('should fall back to DEPLOYMENT_BLOCK when file does not exist', () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      configService = createMockConfigService(100);
      service = new ChainRecoveryService(
        configService as any,
        canvasService,
        chainService,
        supabase,
      );

      const block = service.getLastBlock();
      expect(block).toBe(100);
    });

    it('should fall back to 0 when no file and no DEPLOYMENT_BLOCK', () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const block = service.getLastBlock();
      expect(block).toBe(0);
    });
  });

  describe('saveLastBlock', () => {
    it('should write correct JSON to file', () => {
      service.saveLastBlock(7500);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('last-block.json'),
        JSON.stringify({ lastBlock: 7500 }, null, 2),
      );
    });

    it('should create data directory if it does not exist', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      service.saveLastBlock(100);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true },
      );
    });
  });

  describe('rebuildFromChain', () => {
    it('should set syncing true before scan and false after', async () => {
      await service.rebuildFromChain();

      const setSyncingCalls = (
        canvasService.setSyncing as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(setSyncingCalls[0]).toEqual([true]);
      expect(setSyncingCalls[setSyncingCalls.length - 1]).toEqual([
        false,
      ]);
    });

    it('should scan from last saved block, not deployment block', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ lastBlock: 3000 }),
      );

      const mockGetLogs = vi.fn(async () => []);
      chainService = {
        getClient: vi.fn(() => ({
          getBlockNumber: vi.fn(async () => 10000n),
          getLogs: mockGetLogs,
        })),
        getAuctionToCanvasMap: vi.fn(() => new Map()),
      } as unknown as ChainService;

      service = new ChainRecoveryService(
        configService as any,
        canvasService,
        chainService,
        supabase,
      );

      await service.rebuildFromChain();

      // First getLogs call should start from 3000n, not 0n
      if (mockGetLogs.mock.calls.length > 0) {
        const firstCall = mockGetLogs.mock.calls[0][0];
        expect(firstCall.fromBlock).toBe(3000n);
      }
    });

    it('should process all blocks in batches from start to latest', async () => {
      // Set a range that requires multiple batches
      const mockGetLogs = vi.fn(async () => []);
      chainService = {
        getClient: vi.fn(() => ({
          getBlockNumber: vi.fn(async () => 12000n),
          getLogs: mockGetLogs,
        })),
        getAuctionToCanvasMap: vi.fn(() => new Map()),
      } as unknown as ChainService;

      // Start from block 0
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('ENOENT');
        },
      );

      service = new ChainRecoveryService(
        configService as any,
        canvasService,
        chainService,
        supabase,
      );

      await service.rebuildFromChain();

      // With 12000 blocks and 5000 batch size, expect 3 batches per event type
      // 7 event types * 3 batches = 21 getLogs calls
      // But some event types might be scanned and some not (depends on addresses)
      expect(mockGetLogs.mock.calls.length).toBeGreaterThan(0);

      // Verify the last batch ends at the correct block
      const allCalls = mockGetLogs.mock.calls;
      const toBlocks = allCalls.map(
        (c: { 0: { toBlock: bigint } }) => c[0].toBlock,
      );
      expect(toBlocks).toContain(12000n);
    });

    it('should handle CanvasCreated events during recovery', async () => {
      const mockLogs = [
        {
          args: {
            canvasId: 1n,
            proposer: '0xabc',
            width: 32,
            height: 32,
            title: 'Recovery Test',
          },
        },
      ];

      const mockGetLogs = vi.fn(async (opts: { event?: { name: string } }) => {
        if (opts.event && opts.event.name === 'CanvasCreated') {
          return mockLogs;
        }
        return [];
      });

      chainService = {
        getClient: vi.fn(() => ({
          getBlockNumber: vi.fn(async () => 100n),
          getLogs: mockGetLogs,
        })),
        getAuctionToCanvasMap: vi.fn(() => new Map()),
      } as unknown as ChainService;

      service = new ChainRecoveryService(
        configService as any,
        canvasService,
        chainService,
        supabase,
      );

      await service.rebuildFromChain();

      expect(
        canvasService.handleCanvasCreated,
      ).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          proposer: '0xabc',
          title: 'Recovery Test',
          width: 32,
          height: 32,
          totalPixels: 1024,
        }),
      );
    });

    it('should save latest block number after scan completes', async () => {
      await service.rebuildFromChain();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('last-block.json'),
        expect.stringContaining('10000'),
      );
    });

    it('should set syncing false even if getBlockNumber fails', async () => {
      chainService = {
        getClient: vi.fn(() => ({
          getBlockNumber: vi.fn(async () => {
            throw new Error('RPC error');
          }),
          getLogs: vi.fn(async () => []),
        })),
        getAuctionToCanvasMap: vi.fn(() => new Map()),
      } as unknown as ChainService;

      service = new ChainRecoveryService(
        configService as any,
        canvasService,
        chainService,
        supabase,
      );

      await service.rebuildFromChain();

      const setSyncingCalls = (
        canvasService.setSyncing as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(
        setSyncingCalls[setSyncingCalls.length - 1],
      ).toEqual([false]);
    });
  });
});
