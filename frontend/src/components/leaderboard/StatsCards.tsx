'use client';

import type { PlatformStats } from '@/hooks/useLeaderboard';

interface StatsCardsProps {
  stats: PlatformStats | null;
  isLoading: boolean;
}

const formatter = new Intl.NumberFormat();

function StatCard({ label, value, isLoading }: { label: string; value: number | undefined; isLoading: boolean }) {
  return (
    <div
      className="bg-surface border border-grid p-6 text-center"
      style={{
        borderRadius: 0,
        boxShadow: 'var(--shadow-pixel)',
      }}
    >
      <p className="font-display text-xl sm:text-2xl text-accent mb-2">
        {isLoading || value === undefined ? (
          <span className="animate-pixel-blink">---</span>
        ) : (
          formatter.format(value)
        )}
      </p>
      <p className="font-body text-sm text-text-muted">{label}</p>
    </div>
  );
}

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard label="Total Canvases" value={stats?.totalCanvases} isLoading={isLoading} />
      <StatCard label="Total Pixels" value={stats?.totalPixels} isLoading={isLoading} />
      <StatCard label="Active Artists" value={stats?.activeArtists} isLoading={isLoading} />
    </div>
  );
}
