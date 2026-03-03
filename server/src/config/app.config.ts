import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rpcUrl: process.env.RPC_URL || 'https://seoul.worldland.foundation',
  pixelCanvasAddress: process.env.PIXEL_CANVAS_ADDRESS || '',
  canvasAuctionAddress: process.env.CANVAS_AUCTION_ADDRESS || '',
  revenueDistributorAddress: process.env.REVENUE_DISTRIBUTOR_ADDRESS || '',
  deploymentBlock: parseInt(process.env.DEPLOYMENT_BLOCK || '0', 10),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
}));
