'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { useCanvasState } from '@/hooks/useCanvasState';
import { usePaintPixel } from '@/hooks/usePaintPixel';
import { useCooldown } from '@/hooks/useCooldown';
import { useCanvasStore } from '@/stores/canvasStore';
import { CONTRACTS, CanvasNFTReadABI } from '@/config/contracts';
import PixelCanvas, { type PixelCanvasHandle } from '@/components/canvas/PixelCanvas';
import ColorPalette from '@/components/canvas/ColorPalette';
import CooldownTimer from '@/components/canvas/CooldownTimer';
import CanvasToolbar from '@/components/canvas/CanvasToolbar';
import { AuctionPanel } from '@/components/auction/AuctionPanel';
import TimelapsePlayer from '@/components/timelapse/TimelapsePlayer';
import ShareButtons from '@/components/share/ShareButtons';
import PixelBlockBackground from '@/components/background/PixelBlockBackground';
import { getCanvasShareUrl } from '@/lib/share';

/** Status badge for canvas state */
function StatusBadge({ state }: { state: string }) {
  let label = 'ACTIVE';
  let colorClass = 'bg-accent text-void';

  switch (state) {
    case 'active':
      label = 'ACTIVE';
      colorClass = 'bg-accent text-void';
      break;
    case 'completed':
      label = 'COMPLETED';
      colorClass = 'bg-warning text-void';
      break;
    case 'auctioning':
      label = 'AUCTION LIVE';
      colorClass = 'bg-warning text-void';
      break;
    case 'settled':
      label = 'SETTLED';
      colorClass = 'bg-success text-void';
      break;
  }

  return (
    <span
      className={`font-display text-xs px-2 py-1 ${colorClass}`}
      style={{ borderRadius: 0 }}
    >
      {label}
    </span>
  );
}

/** Truncate address to 0x1234...5678 format */
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function CanvasPage() {
  const params = useParams();
  const rawId = params?.id;
  const canvasId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
  const validCanvasId = isNaN(canvasId) ? 0 : canvasId;

  const { address, isConnected } = useAccount();
  const selectedColorIndex = useCanvasStore((s) => s.selectedColorIndex);

  const canvasRef = useRef<PixelCanvasHandle>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 1. Connect socket
  useSocket();

  // Callbacks for canvas state hooks -- stable via useCallback
  const onFullRedraw = useCallback(() => {
    canvasRef.current?.fullRedraw();
  }, []);

  const onPixelUpdate = useCallback((x: number, y: number, colorIndex: number) => {
    canvasRef.current?.updatePixel(x, y, colorIndex);
  }, []);

  // 2. Join canvas room, get metadata + pixelsRef
  const { metadata, pixelsRef, isLoading } = useCanvasState({
    canvasId: validCanvasId,
    onFullRedraw,
    onPixelUpdate,
  });

  // 3. Cooldown timer
  const { remaining, isOnCooldown, displaySeconds, startCooldown } = useCooldown(
    metadata?.cooldownSeconds ?? 30,
  );

  // 4. Paint pixel hook
  const { paint, isPainting, paintError } = usePaintPixel({
    canvasId: validCanvasId,
    width: metadata?.width ?? 0,
    pixelsRef,
    onPixelUpdate,
    startCooldown,
    isOnCooldown,
  });

  // Show paint errors as toast
  useEffect(() => {
    if (paintError) {
      setToast(paintError);
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [paintError]);

  // 5. Get minted NFT tokenId for settled canvases
  const isSettled = metadata?.state === 'settled';
  const { data: mintedTokenId } = useReadContract({
    address: CONTRACTS.canvasNFT.address,
    abi: CanvasNFTReadABI,
    functionName: 'getTokenByCanvas',
    args: [BigInt(validCanvasId)],
    query: { enabled: validCanvasId >= 0 && isSettled },
  });

  // Handle pixel click
  const onPixelClick = useCallback(
    (x: number, y: number) => {
      if (!isConnected || !address) {
        setToast('Connect wallet to paint');
        setTimeout(() => setToast(null), 3000);
        return;
      }
      if (isPainting) {
        setToast('Confirm the pending transaction first');
        setTimeout(() => setToast(null), 2000);
        return;
      }
      if (isOnCooldown) {
        setToast('Wait for cooldown');
        setTimeout(() => setToast(null), 2000);
        return;
      }
      paint(x, y, selectedColorIndex, address);
    },
    [isConnected, address, isPainting, isOnCooldown, paint, selectedColorIndex],
  );

  // Error: invalid canvas ID
  if (isNaN(canvasId) || canvasId < 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] mt-14">
        <div
          className="bg-surface border border-grid p-6 text-center"
          style={{ borderRadius: 0 }}
        >
          <p className="font-display text-sm text-error">Invalid Canvas ID</p>
          <p className="font-body text-sm text-text-muted mt-2">
            Canvas ID must be a non-negative number.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !metadata) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] mt-14">
        <div className="text-center">
          <p className="font-display text-sm text-accent animate-pixel-blink">
            Loading canvas...
          </p>
          <p className="font-body text-sm text-text-muted mt-2">
            Connecting to canvas #{canvasId}
          </p>
        </div>
      </div>
    );
  }

  const isActive = metadata.state === 'active';
  const isAuctioning = metadata.state === 'auctioning';
  const isCompleted = metadata.state === 'completed';
  const isInteractive = isActive;

  // Render active painting UI (full-screen canvas with sidebar)
  if (isActive) {
    return (
      <div className="flex flex-col h-[calc(100vh-56px)] mt-14">
        {/* Toolbar */}
        <CanvasToolbar
          title={metadata.title || `Canvas #${canvasId}`}
          width={metadata.width}
          height={metadata.height}
          filledPixels={metadata.filledPixels}
          totalPixels={metadata.totalPixels}
        />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div className="flex-1 relative">
            <PixelCanvas
              ref={canvasRef}
              width={metadata.width}
              height={metadata.height}
              pixelsRef={pixelsRef}
              selectedColorIndex={selectedColorIndex}
              onPixelClick={onPixelClick}
            />

            {/* Toast notification */}
            {toast && (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface border border-grid px-4 py-2 font-body text-sm text-warning z-10"
                style={{
                  borderRadius: 0,
                  boxShadow: 'var(--shadow-pixel-sm)',
                  animation: 'fadeIn 0.1s steps(2)',
                }}
              >
                {toast}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-64 bg-surface border-l border-grid p-3 flex flex-col gap-3 overflow-y-auto">
            {/* Color palette */}
            <ColorPalette />

            {/* Cooldown timer */}
            <CooldownTimer
              isOnCooldown={isOnCooldown}
              isPainting={isPainting}
              displaySeconds={displaySeconds}
              remaining={remaining}
              totalCooldownMs={(metadata.cooldownSeconds ?? 30) * 1000}
            />

            {/* Canvas info */}
            <CanvasInfoPanel metadata={metadata} canvasId={canvasId} />

            {/* Share buttons */}
            <ShareButtons
              url={getCanvasShareUrl(canvasId)}
              title={`${metadata.title || `Canvas #${canvasId}`} on Cellarium`}
            />

            {/* Wallet status */}
            {!isConnected && (
              <div
                className="border border-warning p-3 text-center"
                style={{ borderRadius: 0 }}
              >
                <p className="font-body text-sm text-warning">
                  Connect wallet to paint pixels
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // Render auctioning/settled/completed layout (canvas artwork + sidebar with auction panel)
  return (
    <div className="min-h-[calc(100vh-56px)] mt-14 p-4">
      <PixelBlockBackground />
      <div className="relative z-10 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-sm text-text">
              {metadata.title || `Canvas #${canvasId}`}
            </h1>
            <StatusBadge state={metadata.state} />
          </div>
          <div className="font-body text-sm text-text-muted space-x-4">
            <span>
              {metadata.width}x{metadata.height}
            </span>
            <span>
              Proposer: {truncateAddress(metadata.proposer)}
            </span>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas artwork area (read-only) */}
          <div className="lg:col-span-2">
            <div
              className="bg-void border border-grid overflow-hidden"
              style={{
                borderRadius: 0,
                boxShadow: '4px 4px 0 0 var(--color-surface-elevated, #2a2a4a)',
              }}
            >
              <PixelCanvas
                ref={canvasRef}
                width={metadata.width}
                height={metadata.height}
                pixelsRef={pixelsRef}
                selectedColorIndex={0}
                onPixelClick={() => {}}
                isInteractive={!isInteractive}
              />
            </div>
          </div>

          {/* Sidebar: Auction panel or canvas info */}
          <div className="space-y-4">
            {/* Auction Panel for auctioning/settled states */}
            {(isAuctioning || isSettled) && (
              <AuctionPanel canvasId={canvasId} />
            )}

            {/* NFT link for settled canvases */}
            {isSettled && mintedTokenId !== undefined && (
              <Link
                href={`/nft/${Number(mintedTokenId)}`}
                className="block font-display text-xs text-center px-4 py-3 bg-accent text-void hover:bg-accent-hover"
                style={{
                  borderRadius: 0,
                  boxShadow: '4px 4px 0 0 var(--color-surface-elevated, #2a2a4a)',
                  transition: 'background-color 0.1s steps(1)',
                }}
              >
                View NFT #{Number(mintedTokenId)}
              </Link>
            )}

            {/* Completed state: auction starting message */}
            {isCompleted && (
              <div
                className="bg-surface border border-warning p-4 text-center"
                style={{ borderRadius: 0 }}
              >
                <p className="font-display text-xs text-warning">
                  Auction starting...
                </p>
                <p className="font-body text-sm text-text-muted mt-2">
                  This canvas is complete. The auction will begin momentarily.
                </p>
              </div>
            )}

            {/* Timelapse player for non-active canvases */}
            <TimelapsePlayer
              canvasId={canvasId}
              width={metadata.width}
              height={metadata.height}
            />

            {/* Canvas info */}
            <CanvasInfoPanel metadata={metadata} canvasId={canvasId} />

            {/* Share buttons */}
            <ShareButtons
              url={getCanvasShareUrl(canvasId)}
              title={`${metadata.title || `Canvas #${canvasId}`} on Cellarium`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Canvas info panel -- shared between active and auction layouts */
function CanvasInfoPanel({
  metadata,
  canvasId,
}: {
  metadata: {
    state: string;
    proposer: string;
    cooldownSeconds: number;
    createdAt: number;
    filledPixels: number;
    totalPixels: number;
  };
  canvasId: number;
}) {
  return (
    <div
      className="bg-surface border border-grid p-3"
      style={{ borderRadius: 0 }}
    >
      <h3 className="font-display text-xs text-text mb-2">Info</h3>
      <div className="font-body text-sm text-text-muted space-y-1">
        <p>
          <span className="text-text-dim">Canvas:</span>{' '}
          <span className="text-text">#{canvasId}</span>
        </p>
        <p>
          <span className="text-text-dim">State:</span>{' '}
          <span
            className={
              metadata.state === 'active'
                ? 'text-success'
                : metadata.state === 'completed'
                  ? 'text-warning'
                  : metadata.state === 'auctioning'
                    ? 'text-warning'
                    : metadata.state === 'settled'
                      ? 'text-success'
                      : 'text-text'
            }
          >
            {metadata.state}
          </span>
        </p>
        <p>
          <span className="text-text-dim">Proposer:</span>{' '}
          {metadata.proposer
            ? truncateAddress(metadata.proposer)
            : 'Unknown'}
        </p>
        <p>
          <span className="text-text-dim">Pixels:</span>{' '}
          {metadata.filledPixels}/{metadata.totalPixels}
        </p>
        {metadata.createdAt > 0 && (
          <p>
            <span className="text-text-dim">Created:</span>{' '}
            {new Date(metadata.createdAt * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
