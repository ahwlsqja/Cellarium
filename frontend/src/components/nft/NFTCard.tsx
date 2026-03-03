'use client';

import Link from 'next/link';

interface NFTCardProps {
  tokenId: number;
  name: string;
  imageDataUri: string;
  canvasId: number;
}

export function NFTCard({ tokenId, name, imageDataUri, canvasId }: NFTCardProps) {
  return (
    <Link
      href={`/nft/${tokenId}`}
      className="block bg-surface border border-grid p-0 group"
      style={{
        borderRadius: 0,
        boxShadow: '4px 4px 0 0 var(--color-surface-elevated, #2a2a4a)',
        transition: 'transform 0.1s steps(1), border-color 0.1s steps(1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent, #51bdff)';
        e.currentTarget.style.transform = 'translate(-2px, -2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '';
        e.currentTarget.style.transform = 'translate(0, 0)';
      }}
    >
      {/* Image area */}
      <div
        className="w-full aspect-square bg-white border-b border-grid overflow-hidden flex items-center justify-center"
      >
        {imageDataUri ? (
          <img
            src={imageDataUri}
            alt={name}
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="w-full h-full bg-surface flex items-center justify-center">
            <span className="font-body text-sm text-text-muted">No image</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="font-display text-xs text-text truncate">{name}</p>
        <p className="font-body text-sm text-text-muted">
          Canvas #{canvasId}
        </p>
      </div>
    </Link>
  );
}
