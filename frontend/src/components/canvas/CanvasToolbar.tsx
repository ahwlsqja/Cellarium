'use client';

import { useCanvasStore } from '@/stores/canvasStore';

interface CanvasToolbarProps {
  title: string;
  width: number;
  height: number;
  filledPixels: number;
  totalPixels: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 40;
const ZOOM_STEP = 0.25;

export default function CanvasToolbar({
  title,
  width,
  height,
  filledPixels,
  totalPixels,
}: CanvasToolbarProps) {
  const { scale, setScale, resetView, tool, setTool } = useCanvasStore();

  const zoomIn = () => {
    setScale(Math.min(MAX_SCALE, scale + ZOOM_STEP));
  };

  const zoomOut = () => {
    setScale(Math.max(MIN_SCALE, scale - ZOOM_STEP));
  };

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      className="bg-surface border border-grid p-2 flex items-center gap-2 flex-wrap"
      style={{ borderRadius: 0 }}
    >
      {/* Title */}
      <span className="font-display text-xs text-text truncate max-w-[160px]">
        {title}
      </span>

      {/* Separator */}
      <span className="text-grid">|</span>

      {/* Dimensions */}
      <span className="font-body text-sm text-text-muted">
        <span className="font-accent text-text">{width}</span>x
        <span className="font-accent text-text">{height}</span>
      </span>

      {/* Separator */}
      <span className="text-grid">|</span>

      {/* Filled pixels */}
      <span className="font-body text-sm text-text-muted">
        <span className="font-accent text-text">{filledPixels}</span>
        /{totalPixels} px
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tool toggle */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTool('paint')}
          className={`font-body text-sm px-2 py-1 border ${
            tool === 'paint'
              ? 'border-accent text-accent bg-surface-alt'
              : 'border-grid text-text-muted bg-surface'
          }`}
          style={{
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'color 0.2s steps(3)',
          }}
          title="Paint mode (crosshair)"
        >
          +
        </button>
        <button
          onClick={() => setTool('pan')}
          className={`font-body text-sm px-2 py-1 border ${
            tool === 'pan'
              ? 'border-accent text-accent bg-surface-alt'
              : 'border-grid text-text-muted bg-surface'
          }`}
          style={{
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'color 0.2s steps(3)',
          }}
          title="Pan mode (hand)"
        >
          #
        </button>
      </div>

      {/* Separator */}
      <span className="text-grid">|</span>

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="font-body text-sm px-2 py-1 border border-grid text-text-muted bg-surface hover:text-text disabled:text-text-dim"
          style={{
            borderRadius: 0,
            cursor: scale <= MIN_SCALE ? 'not-allowed' : 'pointer',
          }}
        >
          -
        </button>
        <span
          className="font-accent text-sm text-text min-w-[48px] text-center"
        >
          {zoomPercent}%
        </span>
        <button
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="font-body text-sm px-2 py-1 border border-grid text-text-muted bg-surface hover:text-text disabled:text-text-dim"
          style={{
            borderRadius: 0,
            cursor: scale >= MAX_SCALE ? 'not-allowed' : 'pointer',
          }}
        >
          +
        </button>
        <button
          onClick={resetView}
          className="font-body text-xs px-2 py-1 border border-grid text-text-muted bg-surface hover:text-text"
          style={{
            borderRadius: 0,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
