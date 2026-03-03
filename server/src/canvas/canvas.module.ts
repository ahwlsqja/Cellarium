import { Module } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { CanvasGateway } from './canvas.gateway';

@Module({
  providers: [CanvasService, CanvasGateway],
  exports: [CanvasService, CanvasGateway],
})
export class CanvasModule {}
