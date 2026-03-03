'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

/** Canvas metadata (everything except pixels) */
export interface CanvasMetadata {
  width: number;
  height: number;
  totalPixels: number;
  filledPixels: number;
  title: string;
  description: string;
  proposer: string;
  state: 'active' | 'completed' | 'auctioning' | 'settled';
  cooldownSeconds: number;
  auctionStartPrice: string; // BigInt as string from server
  auctionDuration: number;
  createdAt: number;
}

interface UseCanvasStateOptions {
  canvasId: number;
  onFullRedraw: () => void;
  onPixelUpdate: (x: number, y: number, colorIndex: number) => void;
}

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;

/**
 * Canvas state from WebSocket with room join/leave.
 * CRITICAL: pixel data lives in useRef (NOT React state) to avoid re-renders.
 * Retries joinCanvas if server hasn't synced the canvas yet (chain polling delay).
 */
export function useCanvasState({ canvasId, onFullRedraw, onPixelUpdate }: UseCanvasStateOptions) {
  const pixelsRef = useRef<number[]>([]);
  const widthRef = useRef<number>(0);
  const [metadata, setMetadata] = useState<CanvasMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Store callbacks in refs to avoid effect re-runs
  const onFullRedrawRef = useRef(onFullRedraw);
  const onPixelUpdateRef = useRef(onPixelUpdate);
  onFullRedrawRef.current = onFullRedraw;
  onPixelUpdateRef.current = onPixelUpdate;

  useEffect(() => {
    if (canvasId === undefined || canvasId === null || canvasId < 0) return;

    const socket = getSocket();
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    // Join canvas room (with retry on "not found")
    const joinCanvas = () => {
      socket.emit('joinCanvas', { canvasId });
    };

    joinCanvas();

    // Receive full canvas state
    const handleCanvasState = (data: {
      canvasId: number;
      proposer: string;
      title: string;
      description: string;
      width: number;
      height: number;
      totalPixels: number;
      filledPixels: number;
      pixels: number[];
      state: 'active' | 'completed' | 'auctioning' | 'settled';
      cooldownSeconds: number;
      auctionStartPrice: string;
      auctionDuration: number;
      createdAt: number;
    }) => {
      resolved = true;

      // Store pixels and width in refs (NOT state -- avoids re-renders)
      pixelsRef.current = data.pixels;
      widthRef.current = data.width;

      // Store metadata in state (changes infrequently)
      setMetadata({
        width: data.width,
        height: data.height,
        totalPixels: data.totalPixels,
        filledPixels: data.filledPixels,
        title: data.title,
        description: data.description,
        proposer: data.proposer,
        state: data.state,
        cooldownSeconds: data.cooldownSeconds,
        auctionStartPrice: data.auctionStartPrice,
        auctionDuration: data.auctionDuration,
        createdAt: data.createdAt,
      });

      setIsLoading(false);
      onFullRedrawRef.current();
    };

    // Receive individual pixel updates
    const handlePixelPainted = (data: {
      canvasId: number;
      x: number;
      y: number;
      colorIndex: number;
      painter: string;
    }) => {
      const width = widthRef.current;
      if (!width) {
        return;
      }
      const idx = data.y * width + data.x;
      const prev = pixelsRef.current[idx];
      pixelsRef.current[idx] = data.colorIndex;

      // Update filledPixels count if a new pixel was filled
      if (prev === 0 && data.colorIndex !== 0) {
        setMetadata((m) => m ? { ...m, filledPixels: m.filledPixels + 1 } : m);
      }

      onPixelUpdateRef.current(data.x, data.y, data.colorIndex);
    };

    // Handle errors from server — retry if canvas not found yet
    const handleError = (data: { message: string }) => {
      if (!resolved && data.message?.includes('not found') && retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`[Canvas] Canvas ${canvasId} not found, retrying (${retryCount}/${MAX_RETRIES})...`);
        retryTimer = setTimeout(joinCanvas, RETRY_INTERVAL_MS);
      } else if (!resolved && retryCount >= MAX_RETRIES) {
        console.error('[Canvas] Max retries reached:', data.message);
        setIsLoading(false);
      } else {
        console.error('[Canvas] Server error:', data.message);
      }
    };

    // Also listen for canvasCreated broadcast — if our canvas appears, join immediately
    const handleCanvasCreated = (data: { canvasId: number }) => {
      if (!resolved && data.canvasId === canvasId) {
        console.log(`[Canvas] Canvas ${canvasId} created on server, joining...`);
        joinCanvas();
      }
    };

    socket.on('canvasState', handleCanvasState);
    socket.on('pixelPainted', handlePixelPainted);
    socket.on('error', handleError);
    socket.on('canvasCreated', handleCanvasCreated);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      socket.emit('leaveCanvas', { canvasId });
      socket.off('canvasState', handleCanvasState);
      socket.off('pixelPainted', handlePixelPainted);
      socket.off('error', handleError);
      socket.off('canvasCreated', handleCanvasCreated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  return {
    metadata,
    pixelsRef,
    isLoading,
  };
}
