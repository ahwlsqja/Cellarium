'use client';

import CanvasCard from './CanvasCard';
import type { CanvasSummary, ThumbnailData, FilterType } from '@/hooks/useCanvasList';

interface CanvasGridProps {
  canvases: CanvasSummary[];
  thumbnails: Map<number, ThumbnailData>;
  isLoading: boolean;
  filter: FilterType;
  onClearFilter: () => void;
}

function SkeletonCard() {
  return (
    <div
      className="bg-surface border border-grid"
      style={{ borderRadius: 0, boxShadow: 'var(--shadow-pixel)' }}
    >
      <div className="w-full aspect-square bg-surface-alt animate-pixel-blink" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-2/3 bg-surface-alt animate-pixel-blink" />
        <div className="h-3 w-1/3 bg-surface-alt animate-pixel-blink" />
      </div>
    </div>
  );
}

export default function CanvasGrid({
  canvases,
  thumbnails,
  isLoading,
  filter,
  onClearFilter,
}: CanvasGridProps) {
  // Loading state: 6 skeleton cards
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state: no canvases at all
  if (canvases.length === 0 && filter === 'all') {
    return (
      <div className="text-center py-16">
        <div
          className="inline-block bg-surface border border-grid p-8"
          style={{ borderRadius: 0 }}
        >
          <p className="font-display text-sm text-text-muted mb-2 animate-pixel-blink">
            No canvases yet
          </p>
          <p className="font-body text-sm text-text-dim">
            Be the first to create one.
          </p>
        </div>
      </div>
    );
  }

  // Empty state: no filter results
  if (canvases.length === 0) {
    return (
      <div className="text-center py-16">
        <div
          className="inline-block bg-surface border border-grid p-8"
          style={{ borderRadius: 0 }}
        >
          <p className="font-body text-sm text-text-muted mb-3">
            No {filter} canvases found.
          </p>
          <button
            onClick={onClearFilter}
            className="font-display text-xs px-4 py-2 bg-accent text-void hover:bg-accent-hover"
            style={{
              borderRadius: 0,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-pixel-sm)',
              transition: 'background-color 0.2s steps(3)',
            }}
          >
            Show all
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {canvases.map((canvas) => (
        <CanvasCard
          key={canvas.canvasId}
          canvas={canvas}
          thumbnail={thumbnails.get(canvas.canvasId)}
        />
      ))}
    </div>
  );
}
