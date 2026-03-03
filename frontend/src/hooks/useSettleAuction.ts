'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, CanvasAuctionWriteABI } from '@/config/contracts';

export function useSettleAuction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settle = (auctionId: bigint) => {
    writeContract({
      address: CONTRACTS.canvasAuction.address,
      abi: CanvasAuctionWriteABI,
      functionName: 'settleAuction',
      args: [auctionId],
    });
  };

  return { settle, hash, isPending, isConfirming, isSuccess, error };
}
