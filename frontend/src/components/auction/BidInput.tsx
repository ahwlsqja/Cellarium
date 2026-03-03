'use client';

import { useState } from 'react';
import { parseEther } from 'viem';
import { usePlaceBid } from '@/hooks/usePlaceBid';
import { calculateMinBid, formatWLC } from '@/lib/auction-math';

interface BidInputProps {
  auctionId: bigint;
  highestBid: bigint;
  startPrice: bigint;
  isActive: boolean;
}

export function BidInput({ auctionId, highestBid, startPrice, isActive }: BidInputProps) {
  const [bidAmount, setBidAmount] = useState('');
  const { placeBid, isPending, isConfirming, isSuccess, error } = usePlaceBid();

  const minBid = calculateMinBid(highestBid, startPrice);
  const isDisabled = !isActive || isPending || isConfirming;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidAmount || isDisabled) return;
    try {
      const bidWei = parseEther(bidAmount);
      if (bidWei < minBid) {
        return;
      }
    } catch {
      return;
    }
    placeBid(auctionId, bidAmount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="font-display text-xs text-text-muted">
          Place Bid
        </label>
        <span className="font-body text-sm text-text-muted">
          Min: {formatWLC(minBid)} WLC
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          step="0.001"
          min={formatWLC(minBid)}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder={formatWLC(minBid)}
          disabled={isDisabled}
          className="flex-1 bg-surface border border-grid px-3 py-2 text-text font-body text-base
                     placeholder:text-text-dim
                     focus:outline-none focus:border-accent
                     disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: '2px' }}
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="bg-accent text-void font-display text-xs px-4 py-2
                     hover:bg-accent-hover
                     disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed"
          style={{ borderRadius: '2px', boxShadow: '2px 2px 0 0 rgba(0,0,0,0.3)' }}
        >
          BID
        </button>
      </div>

      {/* Transaction status */}
      {isPending && (
        <p className="font-body text-sm text-warning animate-pixel-blink">Sending...</p>
      )}
      {isConfirming && (
        <p className="font-body text-sm text-accent animate-pixel-blink">Confirming...</p>
      )}
      {isSuccess && (
        <p className="font-body text-sm text-success">Bid placed!</p>
      )}
      {error && (
        <p className="font-body text-sm text-error">
          {(error as Error).message?.slice(0, 80) || 'Transaction failed'}
        </p>
      )}
    </form>
  );
}
