/**
 * Canvas state types matching smart contract data structures.
 * Full implementation in Task 2.
 */

export interface CanvasState {
  canvasId: number;
  proposer: string;
  title: string;
  description: string;
  width: number;
  height: number;
  totalPixels: number;
  filledPixels: number;
  pixels: Uint8Array;
  state: 'active' | 'completed' | 'auctioning' | 'settled';
  cooldownSeconds: number;
  auctionStartPrice: bigint;
  auctionDuration: number;
  createdAt: number;
}

export interface AuctionInfo {
  auctionId: number;
  canvasId: number;
  startPrice: bigint;
  endTime: number;
  highestBid: bigint;
  highestBidder: string;
  settled: boolean;
}

export type CanvasSummary = Omit<CanvasState, 'pixels'>;

export interface PixelHistoryEntry {
  x: number;
  y: number;
  colorIndex: number;
  painter: string;
  timestamp: number; // block timestamp or server timestamp
}

export interface LeaderboardEntry {
  address: string;
  pixelCount: number;
}
