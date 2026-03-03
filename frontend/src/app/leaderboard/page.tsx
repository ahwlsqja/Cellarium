'use client';

import { useLeaderboard } from '@/hooks/useLeaderboard';
import StatsCards from '@/components/leaderboard/StatsCards';
import RankingTable from '@/components/leaderboard/RankingTable';
import PixelBlockBackground from '@/components/background/PixelBlockBackground';

export default function LeaderboardPage() {
  const { leaderboard, stats, isLoading, error } = useLeaderboard();

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Animated background */}
      <PixelBlockBackground />

      <div className="relative z-10 mt-14 p-6 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="font-display text-lg sm:text-xl text-text mb-2">
              Leaderboard
            </h1>
            <p className="font-body text-sm text-text-muted">
              All-time pixel painters
            </p>
          </div>

          {/* Stats cards */}
          <div className="mb-8">
            <StatsCards stats={stats} isLoading={isLoading} />
          </div>

          {/* Error state */}
          {error && (
            <div className="text-center py-12">
              <div
                className="inline-block bg-surface border border-grid p-6"
                style={{ borderRadius: 0 }}
              >
                <p className="font-body text-sm text-error">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Ranking table */}
          {!error && !isLoading && (
            <RankingTable entries={leaderboard} />
          )}

          {/* Loading state for table */}
          {isLoading && (
            <div className="text-center py-12">
              <p className="font-display text-sm text-accent animate-pixel-blink">
                Loading rankings...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
