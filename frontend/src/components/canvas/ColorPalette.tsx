'use client';

import { PAINTABLE_INDICES, DB32_COLORS } from '@/lib/palette';
import { useCanvasStore } from '@/stores/canvasStore';
import { useState } from 'react';

/**
 * DB32 color picker with 31 paintable colors.
 * Colors: bg-surface, border-grid, border-accent, border-accent-hover, text-text-muted, text-text (6 max)
 */
export default function ColorPalette() {
  const { selectedColorIndex, setSelectedColor } = useCanvasStore();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className="bg-surface border border-grid p-2"
      style={{ borderRadius: 0, maxWidth: '288px' }}
    >
      {/* Color grid: ~8 columns */}
      <div className="flex flex-wrap gap-1">
        {PAINTABLE_INDICES.map((index) => {
          const isSelected = index === selectedColorIndex;
          const isHovered = index === hoveredIndex;

          return (
            <button
              key={index}
              onClick={() => setSelectedColor(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="relative"
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: DB32_COLORS[index],
                borderRadius: 0,
                border: isSelected
                  ? '2px solid var(--color-accent)'
                  : isHovered
                    ? '2px solid var(--color-accent-hover)'
                    : '1px solid var(--color-grid)',
                boxShadow: isSelected ? 'var(--shadow-pixel-sm)' : 'none',
                transform: isSelected ? 'scale(1.1)' : 'none',
                transition: 'transform 0.2s steps(3)',
                cursor: 'pointer',
                padding: 0,
              }}
              title={`Color ${index}`}
              aria-label={`Select color ${index}`}
            />
          );
        })}
      </div>

      {/* Color info bar */}
      <div
        className="mt-2 text-center"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          minHeight: '20px',
        }}
      >
        {hoveredIndex !== null ? (
          <span>
            #{hoveredIndex}{' '}
            <span style={{ color: DB32_COLORS[hoveredIndex] }}>
              {DB32_COLORS[hoveredIndex]}
            </span>
          </span>
        ) : (
          <span>
            Selected: #{selectedColorIndex}
          </span>
        )}
      </div>
    </div>
  );
}
