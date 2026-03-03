'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { CONTRACTS, CanvasAuctionWriteABI } from '@/config/contracts';

export function usePlaceBid() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBid = (auctionId: bigint, bidAmountEth: string) => {
    writeContract({
      address: CONTRACTS.canvasAuction.address,
      abi: CanvasAuctionWriteABI,
      functionName: 'placeBid',
      args: [auctionId],
      value: parseEther(bidAmountEth),
    });
  };

  return { placeBid, hash, isPending, isConfirming, isSuccess, error };
}
