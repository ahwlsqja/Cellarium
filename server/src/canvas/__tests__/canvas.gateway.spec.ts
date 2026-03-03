import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasGateway } from '../canvas.gateway';
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

// Mock Socket
function createMockSocket() {
  return {
    id: `socket-${Math.random().toString(36).slice(2)}`,
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn().mockReturnThis(),
  };
}

describe('CanvasGateway', () => {
  let gateway: CanvasGateway;
  let canvasService: CanvasService;

  beforeEach(() => {
    canvasService = new CanvasService(createMockSupabase());
    gateway = new CanvasGateway(canvasService);
    // Mock the server
    (gateway as any).server = {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
    };
  });

  describe('connection tracking', () => {
    it('should track connected clients', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      gateway.handleConnection(socket1 as any);
      expect(gateway.getConnectedClientCount()).toBe(1);

      gateway.handleConnection(socket2 as any);
      expect(gateway.getConnectedClientCount()).toBe(2);

      gateway.handleDisconnect(socket1 as any);
      expect(gateway.getConnectedClientCount()).toBe(1);
    });
  });

  describe('joinCanvas', () => {
    it('should join room and emit canvas state', () => {
      canvasService.handleCanvasCreated(1, {
        proposer: '0x1234567890abcdef1234567890abcdef12345678',
        title: 'Join Test',
        width: 4,
        height: 4,
      });

      const socket = createMockSocket();
      gateway.handleJoinCanvas(socket as any, { canvasId: 1 });

      expect(socket.join).toHaveBeenCalledWith('canvas:1');
      expect(socket.emit).toHaveBeenCalledWith(
        'canvasState',
        expect.objectContaining({
          canvasId: 1,
          title: 'Join Test',
          width: 4,
          height: 4,
        }),
      );
    });

    it('should emit error for non-existent canvas', () => {
      const socket = createMockSocket();
      gateway.handleJoinCanvas(socket as any, { canvasId: 999 });

      expect(socket.join).toHaveBeenCalledWith('canvas:999');
      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Canvas 999 not found',
      });
    });

    it('should emit error for invalid canvasId', () => {
      const socket = createMockSocket();
      gateway.handleJoinCanvas(socket as any, {
        canvasId: -1,
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid canvasId',
      });
    });

    it('should convert pixels Uint8Array to array for serialization', () => {
      canvasService.handleCanvasCreated(1, {
        width: 2,
        height: 2,
        title: 'Serialization Test',
      });

      const socket = createMockSocket();
      gateway.handleJoinCanvas(socket as any, { canvasId: 1 });

      const emittedData = socket.emit.mock.calls[0][1];
      expect(Array.isArray(emittedData.pixels)).toBe(true);
      expect(emittedData.pixels).toEqual([0, 0, 0, 0]);
    });

    it('should convert bigint auctionStartPrice to string', () => {
      canvasService.handleCanvasCreated(1, {
        width: 2,
        height: 2,
        title: 'BigInt Test',
        auctionStartPrice: BigInt(1000000),
      });

      const socket = createMockSocket();
      gateway.handleJoinCanvas(socket as any, { canvasId: 1 });

      const emittedData = socket.emit.mock.calls[0][1];
      expect(emittedData.auctionStartPrice).toBe('1000000');
    });
  });

  describe('leaveCanvas', () => {
    it('should leave room', () => {
      const socket = createMockSocket();
      gateway.handleLeaveCanvas(socket as any, { canvasId: 1 });

      expect(socket.leave).toHaveBeenCalledWith('canvas:1');
    });
  });

  describe('paintPixel', () => {
    beforeEach(() => {
      canvasService.handleCanvasCreated(1, {
        proposer: '0x1234567890abcdef1234567890abcdef12345678',
        title: 'Paint Test',
        width: 8,
        height: 8,
      });
    });

    it('should broadcast pixelPainted to room on success', () => {
      const socket = createMockSocket();
      gateway.handlePaintPixel(socket as any, {
        canvasId: 1,
        x: 3,
        y: 4,
        colorIndex: 5,
        painter: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      // Should broadcast to room (excluding sender)
      expect(socket.to).toHaveBeenCalledWith('canvas:1');
      expect(socket.emit).toHaveBeenCalledWith('pixelPainted', {
        canvasId: 1,
        x: 3,
        y: 4,
        colorIndex: 5,
        painter: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
    });

    it('should emit error for invalid colorIndex', () => {
      const socket = createMockSocket();
      gateway.handlePaintPixel(socket as any, {
        canvasId: 1,
        x: 0,
        y: 0,
        colorIndex: 0,
        painter: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid paint pixel data',
      });
    });

    it('should emit error for invalid painter address', () => {
      const socket = createMockSocket();
      gateway.handlePaintPixel(socket as any, {
        canvasId: 1,
        x: 0,
        y: 0,
        colorIndex: 1,
        painter: 'not-an-address',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid paint pixel data',
      });
    });

    it('should emit error for non-existent canvas', () => {
      const socket = createMockSocket();
      gateway.handlePaintPixel(socket as any, {
        canvasId: 999,
        x: 0,
        y: 0,
        colorIndex: 1,
        painter: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to paint pixel on canvas 999',
      });
    });

    it('should emit error for colorIndex > 31', () => {
      const socket = createMockSocket();
      gateway.handlePaintPixel(socket as any, {
        canvasId: 1,
        x: 0,
        y: 0,
        colorIndex: 32,
        painter: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid paint pixel data',
      });
    });
  });
});
