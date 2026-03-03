'use client';

import Link from 'next/link';
import { useNFTDetail } from '@/hooks/useOwnedNFTs';
import ShareButtons from '@/components/share/ShareButtons';
import { getNFTShareUrl } from '@/lib/share';

interface NFTDetailProps {
  tokenId: number;
}

/** Truncate address to 0x1234...5678 format */
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function NFTDetail({ tokenId }: NFTDetailProps) {
  const { metadata, canvasId, owner, isLoading, error } = useNFTDetail(tokenId);

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Skeleton image */}
        <div
          className="w-full aspect-square bg-surface border border-grid animate-pulse"
          style={{ borderRadius: 0, maxWidth: '512px', margin: '0 auto' }}
        />
        {/* Skeleton text */}
        <div className="space-y-3">
          <div className="h-6 bg-surface w-48 animate-pulse" style={{ borderRadius: 0 }} />
          <div className="h-4 bg-surface w-64 animate-pulse" style={{ borderRadius: 0 }} />
          <div className="h-4 bg-surface w-40 animate-pulse" style={{ borderRadius: 0 }} />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !metadata) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div
          className="bg-surface border border-error p-6 text-center"
          style={{ borderRadius: 0 }}
        >
          <p className="font-display text-sm text-error">NFT not found</p>
          <p className="font-body text-sm text-text-muted mt-2">
            Token #{tokenId} does not exist or could not be loaded.
          </p>
          <Link
            href="/nft"
            className="inline-block mt-4 font-display text-xs px-4 py-2 bg-accent text-void hover:bg-accent-hover"
            style={{
              borderRadius: 0,
              transition: 'background-color 0.1s steps(1)',
            }}
          >
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  const explorerUrl = owner
    ? `https://scan.worldland.foundation/address/${owner}`
    : null;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Large SVG artwork display */}
      <div
        className="w-full bg-white border border-grid overflow-hidden flex items-center justify-center"
        style={{
          borderRadius: 0,
          maxWidth: '512px',
          margin: '0 auto',
          boxShadow: '4px 4px 0 0 var(--color-surface-elevated, #2a2a4a)',
        }}
      >
        {metadata.imageDataUri ? (
          <img
            src={metadata.imageDataUri}
            alt={metadata.name}
            className="w-full h-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center bg-surface">
            <span className="font-body text-sm text-text-muted">No image</span>
          </div>
        )}
      </div>

      {/* Metadata section */}
      <div className="space-y-3">
        <h1 className="font-display text-xl text-text">{metadata.name}</h1>
        {metadata.description && (
          <p className="font-body text-base text-text-muted">{metadata.description}</p>
        )}
        {owner && (
          <p className="font-body text-sm text-text-muted">
            <span className="text-text-dim">Owner: </span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover"
                style={{ transition: 'color 0.1s steps(1)' }}
              >
                {truncateAddress(owner)}
              </a>
            ) : (
              truncateAddress(owner)
            )}
          </p>
        )}
      </div>

      {/* Provenance / Attributes */}
      {metadata.attributes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm text-text">Provenance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {metadata.attributes.map((attr) => (
              <div
                key={attr.trait_type}
                className="bg-surface border border-grid p-3 space-y-1"
                style={{
                  borderRadius: 0,
                  boxShadow: '2px 2px 0 0 var(--color-surface-elevated, #2a2a4a)',
                }}
              >
                <p className="font-body text-xs text-text-dim uppercase">
                  {attr.trait_type}
                </p>
                <p className="font-accent text-sm text-text truncate" title={attr.value}>
                  {attr.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action links */}
      <div className="flex gap-3">
        {canvasId !== null && (
          <Link
            href={`/canvas/${canvasId}`}
            className="font-display text-xs px-4 py-2 bg-accent text-void hover:bg-accent-hover"
            style={{
              borderRadius: 0,
              boxShadow: '4px 4px 0 0 var(--color-surface-elevated, #2a2a4a)',
              transition: 'background-color 0.1s steps(1)',
            }}
          >
            View Canvas
          </Link>
        )}
        <Link
          href="/nft"
          className="font-display text-xs px-4 py-2 bg-surface border border-grid text-text hover:border-accent"
          style={{
            borderRadius: 0,
            transition: 'border-color 0.1s steps(1)',
          }}
        >
          Back to Gallery
        </Link>
      </div>

      {/* Share buttons */}
      <ShareButtons
        url={getNFTShareUrl(tokenId)}
        title={`NFT #${tokenId} on Cellarium`}
        description={owner ? `Owned by ${truncateAddress(owner)}` : undefined}
      />
    </div>
  );
}
