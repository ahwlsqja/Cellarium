import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CanvasService } from './canvas.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class CanvasGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CanvasGateway.name);
  private connectedClients = 0;

  constructor(private readonly canvasService: CanvasService) {}

  handleConnection(_client: Socket) {
    this.connectedClients++;
    this.logger.log(
      `Client connected (${this.connectedClients} total)`,
    );
  }

  handleDisconnect(_client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected (${this.connectedClients} total)`,
    );
  }

  getConnectedClientCount(): number {
    return this.connectedClients;
  }

  @SubscribeMessage('joinCanvas')
  handleJoinCanvas(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { canvasId: number },
  ) {
    const canvasId = data?.canvasId;
    if (canvasId === undefined || canvasId === null || typeof canvasId !== 'number' || canvasId < 0) {
      client.emit('error', { message: 'Invalid canvasId' });
      return;
    }

    const roomName = `canvas:${canvasId}`;
    client.join(roomName);

    const state = this.canvasService.getCanvasState(canvasId);
    if (state) {
      // Convert pixels Uint8Array to regular array for JSON serialization
      client.emit('canvasState', {
        ...state,
        pixels: Array.from(state.pixels),
        // bigint cannot be JSON serialized, convert to string
        auctionStartPrice: state.auctionStartPrice.toString(),
      });
    } else {
      client.emit('error', {
        message: `Canvas ${canvasId} not found`,
      });
    }
  }

  @SubscribeMessage('leaveCanvas')
  handleLeaveCanvas(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { canvasId: number },
  ) {
    const canvasId = data?.canvasId;
    if (canvasId === undefined || canvasId === null || typeof canvasId !== 'number' || canvasId < 0) {
      return;
    }
    client.leave(`canvas:${canvasId}`);
  }

  @SubscribeMessage('paintPixel')
  handlePaintPixel(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      canvasId: number;
      x: number;
      y: number;
      colorIndex: number;
      painter: string;
    },
  ) {
    // Validate required fields
    if (
      !data ||
      typeof data.canvasId !== 'number' ||
      data.canvasId < 0 ||
      typeof data.x !== 'number' ||
      data.x < 0 ||
      typeof data.y !== 'number' ||
      data.y < 0 ||
      typeof data.colorIndex !== 'number' ||
      data.colorIndex < 1 ||
      data.colorIndex > 31 ||
      typeof data.painter !== 'string' ||
      !/^0x[a-fA-F0-9]{40}$/.test(data.painter)
    ) {
      client.emit('error', { message: 'Invalid paint pixel data' });
      return;
    }

    const result = this.canvasService.paintPixel(
      data.canvasId,
      data.x,
      data.y,
      data.colorIndex,
      data.painter,
    );

    if (result.success) {
      const payload = {
        canvasId: data.canvasId,
        x: data.x,
        y: data.y,
        colorIndex: data.colorIndex,
        painter: data.painter,
      };

      // Broadcast to all OTHER clients in the room
      client.to(`canvas:${data.canvasId}`).emit('pixelPainted', payload);
      // Acknowledge back to sender
      client.emit('pixelPainted', payload);
    } else {
      client.emit('error', {
        message: `Failed to paint pixel on canvas ${data.canvasId}`,
      });
    }
  }
}
