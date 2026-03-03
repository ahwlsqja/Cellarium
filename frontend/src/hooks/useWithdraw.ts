'use client';

import { useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import {
  CONTRACTS,
  CanvasAuctionWriteABI,
  CanvasAuctionReadABI,
  RevenueDistributorReadWriteABI,
} from '@/config/contracts';

export function useWithdraw() {
  const { address } = useAccount();

  // Read pending revenue from RevenueDistributor
  const {
    data: pendingRevenue,
    refetch: refetchRevenue,
  } = useReadContract({
    address: CONTRACTS.revenueDistributor.address,
    abi: RevenueDistributorReadWriteABI,
    functionName: 'pendingWithdrawal',
    args: [address!],
    query: { enabled: !!address },
  });

  // Read pending bid refund from CanvasAuction
  const {
    data: pendingBidRefund,
    refetch: refetchBidRefund,
  } = useReadContract({
    address: CONTRACTS.canvasAuction.address,
    abi: CanvasAuctionReadABI,
    functionName: 'getPendingReturn',
    args: [address!],
    query: { enabled: !!address },
  });

  // Revenue withdrawal
  const {
    writeContract: writeRevenue,
    data: revenueHash,
    isPending: isRevenuePending,
    error: revenueError,
  } = useWriteContract();
  const {
    isLoading: isRevenueConfirming,
    isSuccess: isRevenueSuccess,
  } = useWaitForTransactionReceipt({ hash: revenueHash });

  // Bid refund withdrawal
  const {
    writeContract: writeBidRefund,
    data: bidRefundHash,
    isPending: isBidRefundPending,
    error: bidRefundError,
  } = useWriteContract();
  const {
    isLoading: isBidRefundConfirming,
    isSuccess: isBidRefundSuccess,
  } = useWaitForTransactionReceipt({ hash: bidRefundHash });

  const withdrawRevenue = () => {
    writeRevenue({
      address: CONTRACTS.revenueDistributor.address,
      abi: RevenueDistributorReadWriteABI,
      functionName: 'withdraw',
    });
  };

  const withdrawBidRefund = () => {
    writeBidRefund({
      address: CONTRACTS.canvasAuction.address,
      abi: CanvasAuctionWriteABI,
      functionName: 'withdrawBidRefund',
    });
  };

  // Refetch pending amounts after successful withdrawals
  useEffect(() => {
    if (isRevenueSuccess) {
      refetchRevenue();
    }
  }, [isRevenueSuccess, refetchRevenue]);

  useEffect(() => {
    if (isBidRefundSuccess) {
      refetchBidRefund();
    }
  }, [isBidRefundSuccess, refetchBidRefund]);

  return {
    pendingRevenue: (pendingRevenue as bigint | undefined) ?? 0n,
    pendingBidRefund: (pendingBidRefund as bigint | undefined) ?? 0n,
    withdrawRevenue,
    withdrawBidRefund,
    isWithdrawing: isRevenuePending || isRevenueConfirming || isBidRefundPending || isBidRefundConfirming,
    revenueStatus: {
      isPending: isRevenuePending,
      isConfirming: isRevenueConfirming,
      isSuccess: isRevenueSuccess,
    },
    bidRefundStatus: {
      isPending: isBidRefundPending,
      isConfirming: isBidRefundConfirming,
      isSuccess: isBidRefundSuccess,
    },
    error: revenueError ?? bidRefundError,
    refetch: () => { refetchRevenue(); refetchBidRefund(); },
  };
}
