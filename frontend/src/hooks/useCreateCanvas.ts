'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog } from 'viem';
import {
  CONTRACTS,
  PixelCanvasWriteABI,
  PixelCanvasEventABI,
} from '@/config/contracts';

export const CANVAS_LIMITS = {
  MIN_SIZE: 4,
  MAX_SIZE: 256,
  MIN_COOLDOWN: 10,      // seconds
  MAX_COOLDOWN: 3600,    // 1 hour
  MIN_AUCTION_DURATION: 3600,    // 1 hour (in seconds)
  MAX_AUCTION_DURATION: 604800,  // 7 days (in seconds)
} as const;

interface CreateCanvasParams {
  title: string;
  description: string;
  width: number;
  height: number;
  cooldownSeconds: number;
  auctionStartPrice: bigint; // in wei
  auctionDuration: number; // in seconds
}

export function useCreateCanvas() {
  const [canvasId, setCanvasId] = useState<bigint | null>(null);

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  // Extract canvasId from CanvasCreated event when receipt arrives
  useEffect(() => {
    if (isSuccess && receipt) {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: PixelCanvasEventABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'CanvasCreated') {
            setCanvasId((decoded.args as { canvasId: bigint }).canvasId);
            break;
          }
        } catch {
          // Not a CanvasCreated event, skip
        }
      }
    }
  }, [isSuccess, receipt]);

  const createCanvas = (params: CreateCanvasParams) => {
    writeContract({
      address: CONTRACTS.pixelCanvas.address,
      abi: PixelCanvasWriteABI,
      functionName: 'createCanvas',
      args: [
        params.title,
        params.description,
        params.width,
        params.height,
        BigInt(params.cooldownSeconds),
        params.auctionStartPrice,
        BigInt(params.auctionDuration),
      ],
    });
  };

  const reset = () => {
    resetWrite();
    setCanvasId(null);
  };

  const error = writeError || receiptError;

  return {
    createCanvas,
    isPending,
    isConfirming,
    isSuccess,
    error,
    canvasId,
    reset,
  };
}
