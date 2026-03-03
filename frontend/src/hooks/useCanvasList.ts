'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export interface CanvasSummary {
  canvasId: number;
  proposer: string;
  title: string;
  description: string;
  width: number;
  height: number;
  totalPixels: number;
  filledPixels: number;
  state: 'active' | 'completed' | 'auctioning' | 'settled';
  cooldownSeconds: number;
  auctionStartPrice: string;
  auctionDuration: number;
  createdAt: number;
}

export interface ThumbnailData {
  width: number;
  height: number;
  pixels: number[];
}

export type FilterType = 'all' | 'active' | 'auctioning' | 'settled';
export type SortType = 'newest' | 'oldest' | 'most-pixels' | 'name';

export function useCanvasList() {
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailData>>(new Map());

  // Fetch all canvases once on mount
  const fetchCanvases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${WS_URL}/api/canvases`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data: CanvasSummary[] = await res.json();
      setCanvases(data);

      // Fetch thumbnails for all canvases in parallel
      const thumbEntries = await Promise.allSettled(
        data.map(async (c) => {
          const thumbRes = await fetch(`${WS_URL}/api/canvas/${c.canvasId}/thumbnail`);
          if (!thumbRes.ok) return null;
          const thumbData: ThumbnailData = await thumbRes.json();
          return [c.canvasId, thumbData] as [number, ThumbnailData];
        })
      );

      const thumbMap = new Map<number, ThumbnailData>();
      for (const result of thumbEntries) {
        if (result.status === 'fulfilled' && result.value) {
          thumbMap.set(result.value[0], result.value[1]);
        }
      }
      setThumbnails(thumbMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch canvases';
      setError(message);
      console.error('[useCanvasList] Fetch error:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCanvases();
  }, [fetchCanvases]);

  // Filter + sort computed from stored canvases (no re-fetch)
  const filteredCanvases = useMemo(() => {
    let result = canvases;

    // Filter by status
    if (filter !== 'all') {
      if (filter === 'settled') {
        // Include both 'completed' and 'settled' under the Settled tab
        result = result.filter((c) => c.state === 'settled' || c.state === 'completed');
      } else {
        result = result.filter((c) => c.state === filter);
      }
    }

    // Sort
    const sorted = [...result];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'most-pixels':
        sorted.sort((a, b) => b.filledPixels - a.filledPixels);
        break;
      case 'name':
        sorted.sort((a, b) => {
          const nameA = a.title || `Canvas #${a.canvasId}`;
          const nameB = b.title || `Canvas #${b.canvasId}`;
          return nameA.localeCompare(nameB);
        });
        break;
    }

    return sorted;
  }, [canvases, filter, sort]);

  return {
    canvases,
    isLoading,
    error,
    filter,
    setFilter,
    sort,
    setSort,
    filteredCanvases,
    thumbnails,
  };
}
