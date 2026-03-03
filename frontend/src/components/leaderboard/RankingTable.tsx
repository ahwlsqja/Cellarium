'use client';

import type { LeaderboardEntry } from '@/hooks/useLeaderboard';

interface RankingTableProps {
  entries: LeaderboardEntry[];
}

const formatter = new Intl.NumberFormat();

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function RankingTable({ entries }: RankingTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-body text-sm text-text-muted">No painters yet</p>
      </div>
    );
  }

  return (
    <div
      className="bg-surface border border-grid overflow-hidden"
      style={{ borderRadius: 0, boxShadow: 'var(--shadow-pixel)' }}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-grid">
            <th className="font-display text-xs text-text-muted text-left px-4 py-3 w-16">#</th>
            <th className="font-display text-xs text-text-muted text-left px-4 py-3">Address</th>
            <th className="font-display text-xs text-text-muted text-right px-4 py-3">Pixels</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;
            return (
              <tr
                key={entry.address}
                className={`border-b border-grid last:border-b-0 ${
                  isTopThree ? 'bg-accent/5' : ''
                }`}
              >
                <td
                  className={`font-accent text-sm px-4 py-3 ${
                    isTopThree ? 'text-accent' : 'text-text-dim'
                  }`}
                >
                  {rank}
                </td>
                <td className="font-body text-sm text-text px-4 py-3">
                  {truncateAddress(entry.address)}
                </td>
                <td className="font-accent text-sm text-text-muted text-right px-4 py-3">
                  {formatter.format(entry.pixelCount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
