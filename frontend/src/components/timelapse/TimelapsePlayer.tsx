'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTimelapse } from '@/hooks/useTimelapse';
import { DB32_COLORS, EMPTY_COLOR } from '@/lib/palette';

interface TimelapsePlayerProps {
  canvasId: number;
  width: number;
  height: number;
}

/**
 * Canvas 2D timelapse renderer with Play/Pause control.
 * Replays the painting history of a completed canvas as an animation.
 */
export default function TimelapsePlayer({ canvasId, width, height }: TimelapsePlayerProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const redrawRef = useRef<() => void>(() => {});

  // Call useTimelapse first -- it uses onFrame via a ref internally, so no circular dep
  const { isPlaying, progress, isLoaded, play, pause, reset, pixelsRef } = useTimelapse({
    canvasId,
    width,
    height,
    onFrame: () => redrawRef.current(),
  });

  const redraw = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const cellSize = Math.floor(containerWidth / width);
    const canvasWidth = cellSize * width;
    const canvasHeight = cellSize * height;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear to white
    ctx.fillStyle = EMPTY_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw pixels
    const pixels = pixelsRef.current;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = pixels[y * width + x];
        if (colorIndex > 0) {
          ctx.fillStyle = DB32_COLORS[colorIndex] ?? EMPTY_COLOR;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [width, height, pixelsRef]);

  // Keep redrawRef in sync
  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  // Initial draw when loaded
  useEffect(() => {
    if (isLoaded) {
      redraw();
    }
  }, [isLoaded, redraw]);

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      redraw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [redraw]);

  if (!isLoaded) {
    return (
      <div
        className="bg-surface border border-grid p-3"
        style={{ borderRadius: 0 }}
      >
        <h3 className="font-display text-xs text-text mb-2">Timelapse</h3>
        <div className="text-center py-4">
          <p className="font-body text-sm text-text-muted animate-pixel-blink">
            Loading history...
          </p>
        </div>
      </div>
    );
  }

  const isComplete = progress >= 1;
  const progressPercent = Math.round(progress * 100);

  return (
    <div
      className="bg-surface border border-grid p-3"
      style={{ borderRadius: 0 }}
    >
      <h3 className="font-display text-xs text-text mb-2">Timelapse</h3>

      {/* Canvas display */}
      <div
        ref={containerRef}
        className="w-full bg-white border border-grid overflow-hidden"
        style={{ borderRadius: 0 }}
      >
        <canvas
          ref={canvasElRef}
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />
      </div>

      {/* Controls */}
      <div className="mt-2 space-y-2">
        {/* Progress bar */}
        <div
          className="w-full h-2 bg-void border border-grid overflow-hidden"
          style={{ borderRadius: 0 }}
        >
          <div
            className="h-full bg-accent"
            style={{
              width: `${progressPercent}%`,
              transition: 'width 0.1s steps(10)',
              borderRadius: 0,
            }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {isComplete ? (
            <button
              onClick={() => {
                reset();
                // Small delay to allow state reset before playing
                requestAnimationFrame(() => {
                  play();
                });
              }}
              className="font-display text-xs px-3 py-1 bg-accent text-void hover:bg-accent-hover"
              style={{
                borderRadius: 0,
                transition: 'background-color 0.1s steps(1)',
              }}
            >
              Replay
            </button>
          ) : (
            <button
              onClick={isPlaying ? pause : play}
              className="font-display text-xs px-3 py-1 bg-accent text-void hover:bg-accent-hover"
              style={{
                borderRadius: 0,
                transition: 'background-color 0.1s steps(1)',
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          )}

          <span className="font-body text-xs text-text-muted">
            {progressPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}
