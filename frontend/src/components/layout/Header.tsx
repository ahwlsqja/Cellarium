'use client';

import Link from 'next/link';
import { ConnectButton } from '@/components/wallet/ConnectButton';

export default function Header() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface border-b border-grid flex items-center justify-between px-4"
      style={{
        boxShadow: 'var(--shadow-pixel-sm)',
      }}
    >
      {/* Logo + Nav */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link
          href="/"
          className="font-display text-accent text-sm sm:text-base hover:text-accent-hover"
          style={{ transition: 'color 0.2s steps(3)' }}
        >
          Cellarium
        </Link>

        {/* Navigation links - hidden on very small screens */}
        <nav className="hidden sm:flex items-center gap-4">
          <Link
            href="/browse"
            className="font-body text-sm text-text-muted hover:text-accent"
            style={{ transition: 'color 0.2s steps(3)' }}
          >
            Browse
          </Link>
          <Link
            href="/create"
            className="font-body text-sm text-text-muted hover:text-accent"
            style={{ transition: 'color 0.2s steps(3)' }}
          >
            Create
          </Link>
          <Link
            href="/leaderboard"
            className="font-body text-sm text-text-muted hover:text-accent"
            style={{ transition: 'color 0.2s steps(3)' }}
          >
            Leaderboard
          </Link>
          <Link
            href="/nft"
            className="font-body text-sm text-text-muted hover:text-accent"
            style={{ transition: 'color 0.2s steps(3)' }}
          >
            My NFTs
          </Link>
        </nav>
      </div>

      {/* Wallet */}
      <ConnectButton />
    </header>
  );
}
