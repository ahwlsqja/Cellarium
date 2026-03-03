'use client';

import { useState, useEffect } from 'react';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted: rbMounted,
      }) => {
        const ready = rbMounted;
        if (!ready) return null;

        // Wrong chain
        if (chain?.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="font-display text-xs px-3 py-2 border border-warning text-warning bg-void"
              style={{
                borderRadius: 0,
                boxShadow: 'var(--shadow-pixel-sm)',
                cursor: 'pointer',
              }}
            >
              Switch to Worldland
            </button>
          );
        }

        // Disconnected
        if (!account) {
          return (
            <button
              onClick={openConnectModal}
              className="font-display text-xs sm:text-sm px-3 py-2 bg-accent text-void hover:bg-accent-hover"
              style={{
                borderRadius: 0,
                boxShadow: 'var(--shadow-pixel-sm)',
                cursor: 'pointer',
                transition: 'background-color 0.2s steps(3), box-shadow 0.2s steps(3)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget.style as CSSStyleDeclaration).boxShadow =
                  'var(--shadow-pixel-accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget.style as CSSStyleDeclaration).boxShadow =
                  'var(--shadow-pixel-sm)';
              }}
            >
              CONNECT
            </button>
          );
        }

        // Connected
        const truncated = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
        return (
          <button
            onClick={openAccountModal}
            className="flex items-center gap-2 font-body text-sm text-text px-3 py-2 bg-surface border border-grid hover:border-accent"
            style={{
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'border-color 0.2s steps(3)',
            }}
          >
            <span
              className="inline-block w-2 h-2 bg-success"
              style={{ borderRadius: 0 }}
            />
            {truncated}
          </button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
