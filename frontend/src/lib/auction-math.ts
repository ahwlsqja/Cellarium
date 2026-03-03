import { formatEther } from 'viem';

const MIN_BID_INCREMENT_BPS = 500n; // 5%
const BPS_DENOMINATOR = 10000n;

/**
 * Calculate the minimum valid bid amount.
 * If no bids yet, returns startPrice.
 * Otherwise, returns highestBid + 5% increment.
 */
export function calculateMinBid(
  highestBid: bigint,
  startPrice: bigint,
): bigint {
  if (highestBid === 0n) {
    return startPrice;
  }
  return highestBid + (highestBid * MIN_BID_INCREMENT_BPS) / BPS_DENOMINATOR;
}

/**
 * Format a wei amount as a human-readable WLC string.
 */
export function formatWLC(weiAmount: bigint): string {
  const eth = formatEther(weiAmount);
  const num = parseFloat(eth);
  if (num === 0) return '0';
  if (num < 0.001) return '<0.001';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * Check if an auction has ended.
 * endTimeSeconds is a Unix timestamp in SECONDS from the contract (block.timestamp).
 */
export function isAuctionEnded(endTimeSeconds: number): boolean {
  return endTimeSeconds <= Math.floor(Date.now() / 1000);
}
