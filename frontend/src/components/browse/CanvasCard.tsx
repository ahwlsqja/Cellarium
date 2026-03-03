'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { DB32_COLORS, EMPTY_COLOR } from '@/lib/palette';
import type { CanvasSummary, ThumbnailData } from '@/hooks/useCanvasList';

function StatusBadge({ state }: { state: CanvasSummary['state'] }) {
  const styles: Record<string, string> = {
    active: 'bg-success/10 text-success',
    completed: 'bg-warning/10 text-warning',
    auctioning: 'bg-pixel-cyan/10 text-pixel-cyan',
    settled: 'bg-text-dim/10 text-text-dim',
  };

  return (
    <span
      className={`inline-block font-body text-xs px-2 py-0.5 ${styles[state] ?? 'text-text-muted'}`}
      style={{ borderRadius: 0 }}
    >
      {state}
    </span>
  );
}

function ContextualInfo({ canvas }: { canvas: CanvasSummary }) {
  const fillPercent =
    canvas.totalPixels > 0
      ? Math.round((canvas.filledPixels / canvas.totalPixels) * 100)
      : 0;

  switch (canvas.state) {
    case 'active':
      return (
        <p className="font-body text-xs text-text-muted">
          {fillPercent}% complete
        </p>
      );
    case 'auctioning':
      return (
        <p className="font-body text-xs text-pixel-cyan">
          Auctioning
        </p>
      );
    case 'settled':
      return (
        <p className="font-body text-xs text-text-dim">
          Settled
        </p>
      );
    case 'completed':
      return (
        <p className="font-body text-xs text-warning">
          Completed
        </p>
      );
    default:
      return null;
  }
}

interface CanvasCardProps {
  canvas: CanvasSummary;
  thumbnail?: ThumbnailData;
}

export default function CanvasCard({ canvas, thumbnail }: CanvasCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw thumbnail pixel data onto the canvas element
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !thumbnail) return;

    const ctx = el.getContext('2d');
    if (!ctx) return;

    el.width = thumbnail.width;
    el.height = thumbnail.height;

    // Draw each pixel
    for (let y = 0; y < thumbnail.height; y++) {
      for (let x = 0; x < thumbnail.width; x++) {
        const idx = y * thumbnail.width + x;
        const colorIndex = thumbnail.pixels[idx] ?? 0;
        const color = colorIndex === 0 ? EMPTY_COLOR : (DB32_COLORS[colorIndex] ?? EMPTY_COLOR);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [thumbnail]);

  return (
    <Link
      href={`/canvas/${canvas.canvasId}`}
      className="block bg-surface border border-grid hover:border-accent group"
      style={{
        borderRadius: 0,
        boxShadow: 'var(--shadow-pixel)',
        transition: 'border-color 0.2s steps(3), box-shadow 0.2s steps(3)',
      }}
    >
      {/* Thumbnail */}
      <div className="w-full aspect-square bg-void overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <div className="w-full h-full bg-surface-alt animate-pixel-blink" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {/* Title + Status */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-display text-xs text-text group-hover:text-accent truncate"
            style={{ transition: 'color 0.2s steps(3)' }}
          >
            {canvas.title || `Canvas #${canvas.canvasId}`}
          </h3>
          <StatusBadge state={canvas.state} />
        </div>

        {/* Dimensions */}
        <p className="font-body text-sm text-text-muted mb-1">
          {canvas.width}x{canvas.height}
        </p>

        {/* Contextual info */}
        <ContextualInfo canvas={canvas} />
      </div>
    </Link>
  );
}
