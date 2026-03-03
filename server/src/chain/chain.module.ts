import { Module } from '@nestjs/common';
import { CanvasModule } from '../canvas/canvas.module';
import { ChainService } from './chain.service';
import { ChainRecoveryService } from './chain.recovery';

@Module({
  imports: [CanvasModule],
  providers: [ChainService, ChainRecoveryService],
  exports: [ChainService, ChainRecoveryService],
})
export class ChainModule {}
