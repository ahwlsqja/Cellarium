'use client';

import { create } from 'zustand';

export interface AuctionData {
  auctionId: number;
  canvasId: number;
  startPrice: bigint;
  highestBid: bigint;
  highestBidder: string;
  endTime: number; // unix seconds
  settled: boolean;
}

interface AuctionStoreState {
  auctions: Map<number, AuctionData>; // auctionId -> data
  canvasAuctions: Map<number, number>; // canvasId -> auctionId

  // Actions
  setAuction: (data: AuctionData) => void;
  updateBid: (auctionId: number, highestBid: bigint, highestBidder: string) => void;
  extendAuction: (auctionId: number, newEndTime: number) => void;
  settleAuction: (auctionId: number) => void;
  getAuctionByCanvas: (canvasId: number) => AuctionData | undefined;
}

export const useAuctionStore = create<AuctionStoreState>((set, get) => ({
  auctions: new Map(),
  canvasAuctions: new Map(),

  setAuction: (data) =>
    set((state) => {
      const auctions = new Map(state.auctions);
      const canvasAuctions = new Map(state.canvasAuctions);
      auctions.set(data.auctionId, data);
      canvasAuctions.set(data.canvasId, data.auctionId);
      return { auctions, canvasAuctions };
    }),

  updateBid: (auctionId, highestBid, highestBidder) =>
    set((state) => {
      const auctions = new Map(state.auctions);
      const existing = auctions.get(auctionId);
      if (existing) {
        auctions.set(auctionId, { ...existing, highestBid, highestBidder });
      }
      return { auctions };
    }),

  extendAuction: (auctionId, newEndTime) =>
    set((state) => {
      const auctions = new Map(state.auctions);
      const existing = auctions.get(auctionId);
      if (existing) {
        auctions.set(auctionId, { ...existing, endTime: newEndTime });
      }
      return { auctions };
    }),

  settleAuction: (auctionId) =>
    set((state) => {
      const auctions = new Map(state.auctions);
      const existing = auctions.get(auctionId);
      if (existing) {
        auctions.set(auctionId, { ...existing, settled: true });
      }
      return { auctions };
    }),

  getAuctionByCanvas: (canvasId) => {
    const state = get();
    const auctionId = state.canvasAuctions.get(canvasId);
    if (auctionId === undefined) return undefined;
    return state.auctions.get(auctionId);
  },
}));
