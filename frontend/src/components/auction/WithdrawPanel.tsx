'use client';

import { useWithdraw } from '@/hooks/useWithdraw';
import { formatWLC } from '@/lib/auction-math';

export function WithdrawPanel() {
  const {
    pendingRevenue,
    pendingBidRefund,
    withdrawRevenue,
    withdrawBidRefund,
    revenueStatus,
    bidRefundStatus,
  } = useWithdraw();

  const hasRevenue = pendingRevenue > 0n;
  const hasBidRefund = pendingBidRefund > 0n;
  const hasNothing = !hasRevenue && !hasBidRefund;

  if (hasNothing) {
    return (
      <div className="bg-surface border border-grid p-4" style={{ borderRadius: '2px' }}>
        <p className="font-body text-sm text-text-muted text-center">
          Nothing to withdraw
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-grid divide-y divide-grid" style={{ borderRadius: '2px' }}>
      {/* Revenue Earnings */}
      {hasRevenue && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs text-text-muted">Revenue Earnings</span>
            <span className="font-mono text-base text-success">
              {formatWLC(pendingRevenue)} WLC
            </span>
          </div>
          <button
            onClick={withdrawRevenue}
            disabled={revenueStatus.isPending || revenueStatus.isConfirming}
            className="w-full bg-success text-void font-display text-xs px-4 py-2
                       hover:opacity-90
                       disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed"
            style={{ borderRadius: '2px', boxShadow: '2px 2px 0 0 rgba(0,0,0,0.3)' }}
          >
            {revenueStatus.isPending ? 'Sending...' :
             revenueStatus.isConfirming ? 'Confirming...' :
             revenueStatus.isSuccess ? 'Withdrawn!' : 'Withdraw'}
          </button>
        </div>
      )}

      {/* Bid Refunds */}
      {hasBidRefund && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs text-text-muted">Bid Refunds</span>
            <span className="font-mono text-base text-warning">
              {formatWLC(pendingBidRefund)} WLC
            </span>
          </div>
          <button
            onClick={withdrawBidRefund}
            disabled={bidRefundStatus.isPending || bidRefundStatus.isConfirming}
            className="w-full bg-warning text-void font-display text-xs px-4 py-2
                       hover:opacity-90
                       disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed"
            style={{ borderRadius: '2px', boxShadow: '2px 2px 0 0 rgba(0,0,0,0.3)' }}
          >
            {bidRefundStatus.isPending ? 'Sending...' :
             bidRefundStatus.isConfirming ? 'Confirming...' :
             bidRefundStatus.isSuccess ? 'Claimed!' : 'Claim Refund'}
          </button>
        </div>
      )}
    </div>
  );
}
