'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';
import { useOwnedNFTs } from '@/hooks/useOwnedNFTs';
import { NFTCard } from './NFTCard';

export function NFTGallery() {
  const { isConnected } = useAccount();
  const { nfts, isLoading, error } = useOwnedNFTs();

  // Prevent hydration mismatch with RainbowKit
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <p className="font-display text-sm text-text text-center">
          Connect your wallet to view your NFTs
        </p>
        <RainbowConnectButton.Custom>
          {({ openConnectModal, mounted: rbMounted }) => {
            if (!rbMounted) return null;
            return (
              <button
                onClick={openConnectModal}
                className="font-display text-xs px-6 py-3 bg-accent text-void hover:bg-accent-hover"
                style={{
                  borderRadius: 0,
                  boxShadow: '4px 4px 0 0 var(--color-surface-elevated, #2a2a4a)',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s steps(1)',
                }}
              >
                CONNECT WALLET
              </button>
            );
          }}
        </RainbowConnectButton.Custom>
      </div>
    );
  }

  // Loading state with skeleton grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-grid animate-pulse"
            style={{ borderRadius: 0 }}
          >
            <div className="w-full aspect-square bg-surface-alt" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-surface-alt w-24" style={{ borderRadius: 0 }} />
              <div className="h-3 bg-surface-alt w-16" style={{ borderRadius: 0 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="bg-surface border border-error p-6 text-center"
        style={{ borderRadius: 0 }}
      >
        <p className="font-display text-sm text-error">Failed to load NFTs</p>
        <p className="font-body text-sm text-text-muted mt-2">
          {error.message}
        </p>
      </div>
    );
  }

  // Empty state
  if (nfts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="font-display text-sm text-text text-center">
          No NFTs yet
        </p>
        <p className="font-body text-base text-text-muted text-center max-w-md">
          Win an auction to earn your first canvas NFT!
        </p>
      </div>
    );
  }

  // NFT grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {nfts.map((nft) => (
        <NFTCard
          key={nft.tokenId}
          tokenId={nft.tokenId}
          name={nft.name}
          imageDataUri={nft.imageDataUri}
          canvasId={nft.canvasId}
        />
      ))}
    </div>
  );
}
