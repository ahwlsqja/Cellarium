'use client';

import { useEffect, useState, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export interface LeaderboardEntry {
  address: string;
  pixelCount: number;
}

export interface PlatformStats {
  totalCanvases: number;
  totalPixels: number;
  activeArtists: number;
}

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [leaderboardRes, statsRes] = await Promise.all([
        fetch(`${WS_URL}/api/leaderboard`),
        fetch(`${WS_URL}/api/stats`),
      ]);

      if (!leaderboardRes.ok) {
        throw new Error(`Leaderboard: ${leaderboardRes.status}`);
      }
      if (!statsRes.ok) {
        throw new Error(`Stats: ${statsRes.status}`);
      }

      const leaderboardData: LeaderboardEntry[] = await leaderboardRes.json();
      const statsData: PlatformStats = await statsRes.json();

      setLeaderboard(leaderboardData);
      setStats(statsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
      setError(message);
      console.error('[useLeaderboard] Fetch error:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { leaderboard, stats, isLoading, error };
}
