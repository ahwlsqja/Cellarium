'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export interface PixelHistoryEntry {
  x: number;
  y: number;
  colorIndex: number;
  painter: string;
  timestamp: number;
}

interface UseTimelapseOptions {
  canvasId: number;
  width: number;
  height: number;
  onFrame?: () => void;
}

interface UseTimelapseReturn {
  isPlaying: boolean;
  progress: number;
  isLoaded: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  pixelsRef: React.MutableRefObject<number[]>;
}

/**
 * Hook for fetching pixel history and controlling timelapse playback.
 * Targets ~20 seconds total playback regardless of canvas size.
 */
export function useTimelapse({
  canvasId,
  width,
  height,
  onFrame,
}: UseTimelapseOptions): UseTimelapseReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const historyRef = useRef<PixelHistoryEntry[]>([]);
  const pixelsRef = useRef<number[]>(new Array(width * height).fill(0));
  const indexRef = useRef(0);
  const rafRef = useRef<number>(0);
  const onFrameRef = useRef(onFrame);

  // Keep onFrame ref up-to-date without triggering re-renders
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Fetch pixel history on mount
  useEffect(() => {
    if (canvasId < 0) return;

    let cancelled = false;

    async function fetchHistory() {
      try {
        const res = await fetch(`${WS_URL}/api/canvas/${canvasId}/history`);
        if (!res.ok) return;
        const data = (await res.json()) as PixelHistoryEntry[];
        if (cancelled) return;
        historyRef.current = data;
        setIsLoaded(true);
      } catch {
        // Silently fail -- timelapse just won't be available
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  // Reset pixel array when dimensions change
  useEffect(() => {
    pixelsRef.current = new Array(width * height).fill(0);
  }, [width, height]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    indexRef.current = 0;
    pixelsRef.current = new Array(width * height).fill(0);
    setProgress(0);
    onFrameRef.current?.();
  }, [width, height]);

  const play = useCallback(() => {
    const history = historyRef.current;
    if (history.length === 0) return;

    // If at the end, reset first
    if (indexRef.current >= history.length) {
      indexRef.current = 0;
      pixelsRef.current = new Array(width * height).fill(0);
      setProgress(0);
    }

    setIsPlaying(true);

    // Adaptive speed: target ~20 seconds at 60fps
    const totalPixels = history.length;
    const pixelsPerFrame = Math.max(1, Math.ceil(totalPixels / (20 * 60)));

    function tick() {
      const h = historyRef.current;
      const end = Math.min(indexRef.current + pixelsPerFrame, h.length);

      for (let i = indexRef.current; i < end; i++) {
        const entry = h[i];
        const idx = entry.y * width + entry.x;
        if (idx >= 0 && idx < pixelsRef.current.length) {
          pixelsRef.current[idx] = entry.colorIndex;
        }
      }

      indexRef.current = end;
      const newProgress = end / h.length;
      setProgress(newProgress);
      onFrameRef.current?.();

      if (end >= h.length) {
        // Playback complete
        setIsPlaying(false);
        setProgress(1);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [width, height]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    isPlaying,
    progress,
    isLoaded,
    play,
    pause,
    reset,
    pixelsRef,
  };
}
