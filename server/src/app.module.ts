import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CanvasModule } from './canvas/canvas.module';
import { ChainModule } from './chain/chain.module';
import { SupabaseModule } from './supabase/supabase.module';
import { HealthController } from './health/health.controller';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    CanvasModule,
    ChainModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
