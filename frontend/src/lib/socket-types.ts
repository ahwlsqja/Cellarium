// Source: server/src/canvas/canvas.gateway.ts + server/src/canvas/canvas.types.ts

/** Events the client EMITS to server */
export interface ClientToServerEvents {
  joinCanvas: (data: { canvasId: number }) => void;
  leaveCanvas: (data: { canvasId: number }) => void;
  paintPixel: (data: {
    canvasId: number;
    x: number;
    y: number;
    colorIndex: number; // 1-31
    painter: string; // 0x address
  }) => void;
}

/** Events the client RECEIVES from server */
export interface ServerToClientEvents {
  canvasState: (data: {
    canvasId: number;
    proposer: string;
    title: string;
    description: string;
    width: number;
    height: number;
    totalPixels: number;
    filledPixels: number;
    pixels: number[]; // Uint8Array converted to array by server
    state: 'active' | 'completed' | 'auctioning' | 'settled';
    cooldownSeconds: number;
    auctionStartPrice: string; // BigInt as string
    auctionDuration: number;
    createdAt: number;
  }) => void;
  pixelPainted: (data: {
    canvasId: number;
    x: number;
    y: number;
    colorIndex: number;
    painter: string;
  }) => void;
  canvasCreated: (data: {
    canvasId: number;
    proposer: string;
    width: number;
    height: number;
    title: string;
  }) => void;
  canvasCompleted: (data: {
    canvasId: number;
    timestamp: number;
  }) => void;
  auctionStarted: (data: {
    canvasId: number;
    auctionId: number;
    startPrice: string; // BigInt as string
    endTime: number;
  }) => void;
  bidPlaced: (data: {
    canvasId: number;
    auctionId: number;
    bidder: string;
    amount: string; // BigInt as string
  }) => void;
  auctionExtended: (data: {
    canvasId: number;
    auctionId: number;
    newEndTime: number;
  }) => void;
  auctionSettled: (data: {
    canvasId: number;
    auctionId: number;
    winner: string;
    amount: string; // BigInt as string
  }) => void;
  revenueDistributed: (data: {
    canvasId: number;
    totalAmount: string;
    contributorsShare: string;
    proposerShare: string;
    platformShare: string;
  }) => void;
  error: (data: { message: string }) => void;
}
