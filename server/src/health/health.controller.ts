import { Controller, Get, Param } from '@nestjs/common';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasGateway } from '../canvas/canvas.gateway';

@Controller()
export class HealthController {
  constructor(
    private readonly canvasService: CanvasService,
    private readonly canvasGateway: CanvasGateway,
  ) {}

  @Get('/health')
  health() {
    return {
      status: 'ok',
      canvasCount: this.canvasService.getAllCanvases().length,
      syncing: this.canvasService.isSyncing(),
      activeConnections: this.canvasGateway.getConnectedClientCount(),
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  }

  @Get('/api/canvases')
  getCanvases() {
    return this.canvasService.getAllCanvasesSummary();
  }

  @Get('/api/leaderboard')
  getLeaderboard() {
    return this.canvasService.getLeaderboard();
  }

  @Get('/api/stats')
  getStats() {
    return this.canvasService.getPlatformStats();
  }

  @Get('/api/canvas/:id/history')
  getCanvasHistory(@Param('id') id: string) {
    const canvasId = parseInt(id, 10);
    if (isNaN(canvasId) || canvasId < 0) return [];
    return this.canvasService.getPixelHistory(canvasId);
  }

  @Get('/api/canvas/:id/thumbnail')
  getCanvasThumbnail(@Param('id') id: string) {
    const canvasId = parseInt(id, 10);
    if (isNaN(canvasId) || canvasId < 0) return { error: 'Invalid canvas ID' };
    return this.canvasService.generateThumbnail(canvasId) ?? { error: 'Canvas not found' };
  }
}
