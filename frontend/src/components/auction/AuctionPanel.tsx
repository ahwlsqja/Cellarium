'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuction } from '@/hooks/useAuction';
import { formatWLC, isAuctionEnded } from '@/lib/auction-math';
import { getSocket } from '@/lib/socket';
import { CountdownTimer } from './CountdownTimer';
import { BidInput } from './BidInput';
import { SettleButton } from './SettleButton';
import { WithdrawPanel } from './WithdrawPanel';

interface AuctionPanelProps {
  canvasId: number;
}

/** Truncate address to 0x1234...5678 format */
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Notification toast data */
interface Toast {
  id: number;
  message: string;
}

export function AuctionPanel({ canvasId }: AuctionPanelProps) {
  const { auction, isActive, isLoading, error, refetch } = useAuction(canvasId);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastCounter, setToastCounter] = useState(0);

  const addToast = useCallback((message: string) => {
    setToastCounter((c) => c + 1);
    setToasts((prev) => [...prev.slice(-2), { id: toastCounter + 1, message }]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 5000);
  }, [toastCounter]);

  // Join/leave canvas room for auction events
  useEffect(() => {
    if (canvasId === undefined || canvasId === null || canvasId < 0) return;

    const socket = getSocket();
    socket.emit('joinCanvas', { canvasId });

    // Listen for bid notifications
    const handleBidPlaced = (data: {
      canvasId: number;
      auctionId: number;
      bidder: string;
      amount: string;
    }) => {
      if (data.canvasId === canvasId) {
        addToast(`New bid: ${formatWLC(BigInt(data.amount))} WLC by ${truncateAddress(data.bidder)}`);
      }
    };

    const handleAuctionSettled = (data: {
      canvasId: number;
      auctionId: number;
      winner: string;
      amount: string;
    }) => {
      if (data.canvasId === canvasId) {
        addToast(`Auction settled! Winner: ${truncateAddress(data.winner)}`);
        refetch();
      }
    };

    socket.on('bidPlaced', handleBidPlaced);
    socket.on('auctionSettled', handleAuctionSettled);

    return () => {
      socket.emit('leaveCanvas', { canvasId });
      socket.off('bidPlaced', handleBidPlaced);
      socket.off('auctionSettled', handleAuctionSettled);
    };
  }, [canvasId, addToast, refetch]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-void border border-grid p-4 space-y-4" style={{ borderRadius: '2px', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.5)' }}>
        <div className="animate-pixel-pulse space-y-3">
          <div className="h-4 bg-surface-elevated w-24" style={{ borderRadius: '2px' }} />
          <div className="h-6 bg-surface-elevated w-40" style={{ borderRadius: '2px' }} />
          <div className="h-4 bg-surface-elevated w-32" style={{ borderRadius: '2px' }} />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-void border border-error p-4" style={{ borderRadius: '2px' }}>
        <p className="font-body text-sm text-error">Failed to load auction data</p>
      </div>
    );
  }

  // No auction state
  if (!auction) {
    return (
      <div className="bg-void border border-grid p-4" style={{ borderRadius: '2px' }}>
        <p className="font-body text-sm text-text-muted text-center">
          No auction for this canvas
        </p>
      </div>
    );
  }

  const ended = isAuctionEnded(auction.endTime);
  const hasNoBids = auction.highestBid === 0n;
  const zeroAddr = '0x0000000000000000000000000000000000000000';

  // Status badge
  let statusLabel = 'Active';
  let statusColor = 'bg-success text-void';
  if (auction.settled) {
    statusLabel = 'Settled';
    statusColor = 'bg-text-muted text-void';
  } else if (ended) {
    statusLabel = 'Ended';
    statusColor = 'bg-warning text-void';
  }

  return (
    <div className="bg-void border border-grid p-4 space-y-4 relative" style={{ borderRadius: '2px', boxShadow: '4px 4px 0 0 rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-text">Auction</h3>
        <span
          className={`font-display text-xs px-2 py-1 ${statusColor}`}
          style={{ borderRadius: '2px' }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Current bid display */}
      <div className="space-y-1">
        <p className="font-body text-xs text-text-muted">
          {hasNoBids ? 'Starting Price' : 'Highest Bid'}
        </p>
        <p className="font-mono text-xl text-text">
          {hasNoBids
            ? `${formatWLC(auction.startPrice)} WLC`
            : `${formatWLC(auction.highestBid)} WLC`
          }
        </p>
        {!hasNoBids && auction.highestBidder !== zeroAddr && (
          <p className="font-body text-sm text-text-muted">
            by {truncateAddress(auction.highestBidder)}
          </p>
        )}
      </div>

      {/* Countdown */}
      {!auction.settled && (
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-text-muted">
            {ended ? 'Status:' : 'Ends in:'}
          </span>
          <CountdownTimer
            endTimeSeconds={auction.endTime}
            onExpire={refetch}
          />
        </div>
      )}

      {/* Bid input (when active) */}
      {isActive && !ended && !auction.settled && (
        <BidInput
          auctionId={BigInt(auction.auctionId)}
          highestBid={auction.highestBid}
          startPrice={auction.startPrice}
          isActive={true}
        />
      )}

      {/* Settle button (when ended but not settled) */}
      {ended && !auction.settled && (
        <SettleButton
          auctionId={BigInt(auction.auctionId)}
          endTimeSeconds={auction.endTime}
          isSettled={auction.settled}
        />
      )}

      {/* Withdraw panel */}
      <WithdrawPanel />

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="absolute top-2 right-2 space-y-1" style={{ zIndex: 10 }}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-surface-elevated border border-accent px-3 py-2 font-body text-xs text-text animate-pixel-bounce"
              style={{ borderRadius: '2px', boxShadow: '2px 2px 0 0 rgba(0,0,0,0.3)' }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
