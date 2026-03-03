import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasService } from '../canvas.service';
import { SupabaseService } from '../../supabase/supabase.service';

function createMockSupabase(): SupabaseService {
  return {
    enabled: false,
    upsertCanvas: vi.fn(async () => {}),
    updateCanvasPixels: vi.fn(async () => {}),
    updateCanvasState: vi.fn(async () => {}),
    upsertAuction: vi.fn(async () => {}),
    insertPixelHistoryBatch: vi.fn(async () => {}),
    incrementPainterStat: vi.fn(async () => {}),
  } as unknown as SupabaseService;
}

describe('CanvasService', () => {
  let service: CanvasService;

  beforeEach(() => {
    service = new CanvasService(createMockSupabase());
  });

  describe('handleCanvasCreated', () => {
    it('should create a new canvas in cache', () => {
      service.handleCanvasCreated(1, {
        proposer: '0x1234567890abcdef1234567890abcdef12345678',
        title: 'Test Canvas',
        description: 'A test canvas',
        width: 16,
        height: 16,
      });

      const canvas = service.getCanvasState(1);
      expect(canvas).toBeDefined();
      expect(canvas!.canvasId).toBe(1);
      expect(canvas!.proposer).toBe(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(canvas!.title).toBe('Test Canvas');
      expect(canvas!.width).toBe(16);
      expect(canvas!.height).toBe(16);
      expect(canvas!.totalPixels).toBe(256);
      expect(canvas!.filledPixels).toBe(0);
      expect(canvas!.state).toBe('active');
      expect(canvas!.pixels).toBeInstanceOf(Uint8Array);
      expect(canvas!.pixels.length).toBe(256);
    });

    it('should initialize all pixels to 0 (empty)', () => {
      service.handleCanvasCreated(1, { width: 4, height: 4 });
      const canvas = service.getCanvasState(1);
      expect(canvas!.pixels.every((p) => p === 0)).toBe(true);
    });
  });

  describe('paintPixel', () => {
    beforeEach(() => {
      service.handleCanvasCreated(1, {
        proposer: '0x1234567890abcdef1234567890abcdef12345678',
        title: 'Paint Test',
        width: 8,
        height: 8,
      });
    });

    it('should paint a valid pixel successfully', () => {
      const result = service.paintPixel(
        1,
        3,
        4,
        5,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(true);
      expect(result.completed).toBe(false);

      const canvas = service.getCanvasState(1);
      expect(canvas!.pixels[4 * 8 + 3]).toBe(5);
      expect(canvas!.filledPixels).toBe(1);
    });

    it('should reject painting on non-existent canvas', () => {
      const result = service.paintPixel(
        999,
        0,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should reject out-of-bounds x coordinate', () => {
      const result = service.paintPixel(
        1,
        8,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should reject out-of-bounds y coordinate', () => {
      const result = service.paintPixel(
        1,
        0,
        8,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should reject negative coordinates', () => {
      const result = service.paintPixel(
        1,
        -1,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should reject colorIndex 0 (empty)', () => {
      const result = service.paintPixel(
        1,
        0,
        0,
        0,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should reject colorIndex 32 (out of DB32 palette)', () => {
      const result = service.paintPixel(
        1,
        0,
        0,
        32,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should not increment filledPixels when overwriting a painted pixel', () => {
      service.paintPixel(
        1,
        0,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(service.getCanvasState(1)!.filledPixels).toBe(1);

      service.paintPixel(
        1,
        0,
        0,
        2,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(service.getCanvasState(1)!.filledPixels).toBe(1);
      expect(service.getCanvasState(1)!.pixels[0]).toBe(2);
    });

    it('should track filledPixels correctly across multiple paints', () => {
      service.paintPixel(
        1,
        0,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      service.paintPixel(
        1,
        1,
        0,
        2,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      service.paintPixel(
        1,
        2,
        0,
        3,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(service.getCanvasState(1)!.filledPixels).toBe(3);
    });

    it('should reject painting on non-active canvas', () => {
      service.handleCanvasStateChange(1, 'completed');
      const result = service.paintPixel(
        1,
        0,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result.success).toBe(false);
    });

    it('should return completed=true when all pixels are filled', () => {
      // Create tiny 2x2 canvas
      service.handleCanvasCreated(2, {
        width: 2,
        height: 2,
        title: 'Tiny',
      });

      service.paintPixel(
        2,
        0,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      service.paintPixel(
        2,
        1,
        0,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      service.paintPixel(
        2,
        0,
        1,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      const result = service.paintPixel(
        2,
        1,
        1,
        1,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );

      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });
  });

  describe('handleCanvasStateChange', () => {
    it('should update canvas state', () => {
      service.handleCanvasCreated(1, { width: 4, height: 4 });
      service.handleCanvasStateChange(1, 'completed');
      expect(service.getCanvasState(1)!.state).toBe('completed');
    });

    it('should not throw for non-existent canvas', () => {
      expect(() =>
        service.handleCanvasStateChange(999, 'completed'),
      ).not.toThrow();
    });
  });

  describe('getAllCanvasesSummary', () => {
    it('should return empty array when no canvases', () => {
      expect(service.getAllCanvasesSummary()).toEqual([]);
    });

    it('should return canvas summaries without pixel data', () => {
      service.handleCanvasCreated(1, {
        width: 4,
        height: 4,
        title: 'Summary Test',
      });
      const summaries = service.getAllCanvasesSummary();
      expect(summaries.length).toBe(1);
      expect(summaries[0].canvasId).toBe(1);
      expect(summaries[0].title).toBe('Summary Test');
      expect((summaries[0] as Record<string, unknown>).pixels).toBeUndefined();
    });
  });

  describe('getActiveCanvasCount', () => {
    it('should count only active canvases', () => {
      service.handleCanvasCreated(1, { width: 4, height: 4 });
      service.handleCanvasCreated(2, { width: 4, height: 4 });
      service.handleCanvasCreated(3, { width: 4, height: 4 });
      service.handleCanvasStateChange(2, 'completed');

      expect(service.getActiveCanvasCount()).toBe(2);
    });
  });

  describe('syncing flag', () => {
    it('should default to false', () => {
      expect(service.isSyncing()).toBe(false);
    });

    it('should be settable', () => {
      service.setSyncing(true);
      expect(service.isSyncing()).toBe(true);
      service.setSyncing(false);
      expect(service.isSyncing()).toBe(false);
    });
  });

  describe('handleAuctionUpdate', () => {
    it('should store auction info', () => {
      const auctionInfo = {
        auctionId: 1,
        canvasId: 1,
        startPrice: BigInt(1000),
        endTime: 1700000000,
        highestBid: BigInt(2000),
        highestBidder: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        settled: false,
      };
      service.handleAuctionUpdate(1, auctionInfo);
      expect(service.getAuctionInfo(1)).toEqual(auctionInfo);
    });
  });
});
