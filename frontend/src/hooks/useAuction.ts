'use client';

import { useEffect, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { CONTRACTS, CanvasAuctionReadABI } from '@/config/contracts';
import { useAuctionStore, type AuctionData } from '@/stores/auctionStore';
import { getSocket } from '@/lib/socket';

interface UseAuctionReturn {
  auction: AuctionData | undefined;
  isActive: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAuction(canvasId: number): UseAuctionReturn {
  const store = useAuctionStore();

  // Get the auctionId for this canvas (reverts if no auction exists)
  const {
    data: auctionId,
    isLoading: isLoadingAuctionId,
    error: auctionIdError,
  } = useReadContract({
    address: CONTRACTS.canvasAuction.address,
    abi: CanvasAuctionReadABI,
    functionName: 'getAuctionByCanvas',
    args: [BigInt(canvasId)],
    query: { enabled: canvasId > 0, retry: false },
  });

  // If getAuctionByCanvas reverted, it means no auction exists — not a real error
  const hasAuction = auctionId !== undefined && !auctionIdError;

  // Get full auction data
  const {
    data: auctionData,
    isLoading: isLoadingAuction,
    error: auctionError,
    refetch: refetchAuction,
  } = useReadContract({
    address: CONTRACTS.canvasAuction.address,
    abi: CanvasAuctionReadABI,
    functionName: 'getAuction',
    args: [auctionId ?? 0n],
    query: { enabled: hasAuction },
  });

  // Check if auction is active
  const {
    data: isActiveOnChain,
    refetch: refetchActive,
  } = useReadContract({
    address: CONTRACTS.canvasAuction.address,
    abi: CanvasAuctionReadABI,
    functionName: 'isAuctionActive',
    args: [auctionId ?? 0n],
    query: { enabled: hasAuction },
  });

  // Sync contract data to zustand store
  useEffect(() => {
    if (auctionData && auctionId !== undefined) {
      const data = auctionData as {
        canvasId: bigint;
        startTime: bigint;
        endTime: bigint;
        startPrice: bigint;
        highestBid: bigint;
        highestBidder: string;
        settled: boolean;
      };
      store.setAuction({
        auctionId: Number(auctionId),
        canvasId: Number(data.canvasId),
        startPrice: data.startPrice,
        highestBid: data.highestBid,
        highestBidder: data.highestBidder,
        endTime: Number(data.endTime),
        settled: data.settled,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionData, auctionId]);

  // Subscribe to Socket.IO events for real-time updates
  useEffect(() => {
    if (canvasId === undefined || canvasId === null || canvasId < 0) return;

    const socket = getSocket();

    const handleBidPlaced = (data: {
      canvasId: number;
      auctionId: number;
      bidder: string;
      amount: string;
    }) => {
      if (data.canvasId === canvasId) {
        store.updateBid(data.auctionId, BigInt(data.amount), data.bidder);
      }
    };

    const handleAuctionExtended = (data: {
      canvasId: number;
      auctionId: number;
      newEndTime: number;
    }) => {
      if (data.canvasId === canvasId) {
        store.extendAuction(data.auctionId, data.newEndTime);
      }
    };

    const handleAuctionSettled = (data: {
      canvasId: number;
      auctionId: number;
      winner: string;
      amount: string;
    }) => {
      if (data.canvasId === canvasId) {
        store.settleAuction(data.auctionId);
      }
    };

    const handleAuctionStarted = (data: {
      canvasId: number;
      auctionId: number;
      startPrice: string;
      endTime: number;
    }) => {
      if (data.canvasId === canvasId) {
        store.setAuction({
          auctionId: data.auctionId,
          canvasId: data.canvasId,
          startPrice: BigInt(data.startPrice),
          highestBid: 0n,
          highestBidder: '0x0000000000000000000000000000000000000000',
          endTime: data.endTime,
          settled: false,
        });
      }
    };

    socket.on('bidPlaced', handleBidPlaced);
    socket.on('auctionExtended', handleAuctionExtended);
    socket.on('auctionSettled', handleAuctionSettled);
    socket.on('auctionStarted', handleAuctionStarted);

    return () => {
      socket.off('bidPlaced', handleBidPlaced);
      socket.off('auctionExtended', handleAuctionExtended);
      socket.off('auctionSettled', handleAuctionSettled);
      socket.off('auctionStarted', handleAuctionStarted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  const refetch = useCallback(() => {
    refetchAuction();
    refetchActive();
  }, [refetchAuction, refetchActive]);

  // Get auction from store (includes real-time updates)
  const auction = store.getAuctionByCanvas(canvasId);

  const isLoading = isLoadingAuctionId || isLoadingAuction;
  // Only treat as real error if auction exists but data fetch failed
  const error = hasAuction ? (auctionError as Error | null) : null;

  return {
    auction,
    isActive: isActiveOnChain === true,
    isLoading,
    error,
    refetch,
  };
}
