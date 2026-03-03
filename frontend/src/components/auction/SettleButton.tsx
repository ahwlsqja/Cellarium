'use client';

import { useSettleAuction } from '@/hooks/useSettleAuction';
import { isAuctionEnded } from '@/lib/auction-math';

interface SettleButtonProps {
  auctionId: bigint;
  endTimeSeconds: number;
  isSettled: boolean;
}

export function SettleButton({ auctionId, endTimeSeconds, isSettled }: SettleButtonProps) {
  const { settle, isPending, isConfirming, isSuccess, error } = useSettleAuction();

  const ended = isAuctionEnded(endTimeSeconds);
  const canSettle = ended && !isSettled && !isPending && !isConfirming;

  const handleSettle = () => {
    if (canSettle) {
      settle(auctionId);
    }
  };

  let label = 'Settle Auction';
  if (isPending) label = 'Settling...';
  if (isConfirming) label = 'Confirming...';
  if (isSuccess || isSettled) label = 'Settled';

  return (
    <div className="space-y-2">
      <button
        onClick={handleSettle}
        disabled={!canSettle}
        className={`w-full font-display text-xs px-4 py-3
          ${canSettle
            ? 'bg-pixel-cyan text-void hover:bg-accent-hover cursor-pointer'
            : 'bg-surface-elevated text-text-muted cursor-not-allowed'
          }`}
        style={{ borderRadius: '2px', boxShadow: canSettle ? '2px 2px 0 0 rgba(0,0,0,0.3)' : 'none' }}
      >
        {label}
      </button>
      {error && (
        <p className="font-body text-sm text-error">
          {(error as Error).message?.slice(0, 80) || 'Settlement failed'}
        </p>
      )}
    </div>
  );
}
