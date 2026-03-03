'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import PixelBlockBackground from '@/components/background/PixelBlockBackground';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useCreateCanvas, CANVAS_LIMITS } from '@/hooks/useCreateCanvas';

// --- Preset definitions ---
const SIZE_PRESETS = [
  { label: '4x4', w: 4, h: 4 },
  { label: '16x16', w: 16, h: 16 },
  { label: '32x32', w: 32, h: 32 },
  { label: '64x64', w: 64, h: 64 },
  { label: '128x128', w: 128, h: 128 },
];

const COOLDOWN_PRESETS = [
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1min', value: 60 },
  { label: '5min', value: 300 },
  { label: '1hr', value: 3600 },
];

const DURATION_PRESETS = [
  { label: '1hr', value: 3600 },
  { label: '6hr', value: 21600 },
  { label: '12hr', value: 43200 },
  { label: '24hr', value: 86400 },
  { label: '3d', value: 259200 },
  { label: '7d', value: 604800 },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return mins === 1 ? '1 minute' : `${mins} minutes`;
  }
  const hours = Math.floor(seconds / 3600);
  if (seconds < 86400) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  const days = Math.floor(seconds / 86400);
  return days === 1 ? '1 day' : `${days} days`;
}

// --- Canvas Preview Component ---
function CanvasPreview({ width, height }: { width: number; height: number }) {
  const isLarge = width > 64 || height > 64;

  if (isLarge) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
        <div
          className="bg-surface-alt border border-grid p-8 flex flex-col items-center gap-3"
          style={{ borderRadius: 0 }}
        >
          <span className="font-display text-xs text-accent">
            {width} x {height}
          </span>
          <span className="font-body text-sm text-text-muted">
            {(width * height).toLocaleString()} pixels
          </span>
          <div
            className="border border-grid/50 bg-void"
            style={{
              width: Math.min(width, 128),
              height: Math.min(height, 128),
              borderRadius: 0,
            }}
          />
        </div>
      </div>
    );
  }

  const cellSize = width <= 32 ? 8 : 5;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="inline-grid border border-grid"
        style={{
          gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
          borderRadius: 0,
        }}
      >
        {Array.from({ length: width * height }).map((_, i) => (
          <div
            key={i}
            className="bg-void border border-grid/30"
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: 0,
            }}
          />
        ))}
      </div>
      <span className="font-body text-sm text-text-muted">
        {width} x {height} = {(width * height).toLocaleString()} pixels
      </span>
    </div>
  );
}

// --- Main Page ---
export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const {
    createCanvas,
    isPending,
    isConfirming,
    isSuccess,
    error,
    canvasId,
    reset,
  } = useCreateCanvas();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [cooldown, setCooldown] = useState(30);
  const [auctionPrice, setAuctionPrice] = useState('0.01');
  const [auctionDuration, setAuctionDuration] = useState(86400);

  // Validation errors
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Title is required';
    }

    if (description.length > 200) {
      errors.description = `Description too long (${description.length}/200)`;
    }

    if (width < CANVAS_LIMITS.MIN_SIZE || width > CANVAS_LIMITS.MAX_SIZE) {
      errors.width = `Width must be ${CANVAS_LIMITS.MIN_SIZE}-${CANVAS_LIMITS.MAX_SIZE}`;
    }

    if (height < CANVAS_LIMITS.MIN_SIZE || height > CANVAS_LIMITS.MAX_SIZE) {
      errors.height = `Height must be ${CANVAS_LIMITS.MIN_SIZE}-${CANVAS_LIMITS.MAX_SIZE}`;
    }

    if (cooldown < CANVAS_LIMITS.MIN_COOLDOWN || cooldown > CANVAS_LIMITS.MAX_COOLDOWN) {
      errors.cooldown = `Cooldown must be ${CANVAS_LIMITS.MIN_COOLDOWN}-${CANVAS_LIMITS.MAX_COOLDOWN}s`;
    }

    const priceNum = parseFloat(auctionPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.auctionPrice = 'Price must be greater than 0';
    }

    if (
      auctionDuration < CANVAS_LIMITS.MIN_AUCTION_DURATION ||
      auctionDuration > CANVAS_LIMITS.MAX_AUCTION_DURATION
    ) {
      errors.auctionDuration = `Duration must be ${formatDuration(CANVAS_LIMITS.MIN_AUCTION_DURATION)} - ${formatDuration(CANVAS_LIMITS.MAX_AUCTION_DURATION)}`;
    }

    return errors;
  }, [title, description, width, height, cooldown, auctionPrice, auctionDuration]);

  const isFormValid = Object.keys(validationErrors).length === 0;
  const isSubmitDisabled = !isConnected || !isFormValid || isPending || isConfirming || isSuccess;

  // Auto-redirect on success
  useEffect(() => {
    if (isSuccess && canvasId !== null) {
      const timer = setTimeout(() => {
        router.push(`/canvas/${canvasId.toString()}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, canvasId, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuccess && canvasId !== null) {
      router.push(`/canvas/${canvasId.toString()}`);
      return;
    }
    if (isSubmitDisabled) return;

    createCanvas({
      title: title.trim(),
      description: description.trim(),
      width,
      height,
      cooldownSeconds: cooldown,
      auctionStartPrice: parseEther(auctionPrice),
      auctionDuration,
    });
  };

  const getButtonLabel = () => {
    if (isPending) return 'Confirm in Wallet...';
    if (isConfirming) return 'Creating Canvas...';
    if (isSuccess && canvasId !== null) return `Go to Canvas #${canvasId.toString()} →`;
    if (isSuccess) return 'Canvas Created!';
    return 'Create Canvas';
  };

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <PixelBlockBackground />

      <div className="relative z-10 mt-14 p-6 sm:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Page title */}
          <h1 className="font-display text-lg sm:text-xl text-text mb-6">
            Create Canvas
          </h1>

          {/* Wallet not connected */}
          {!isConnected && (
            <div
              className="bg-surface border border-grid p-8 mb-6 flex flex-col items-center gap-4"
              style={{ borderRadius: 0 }}
            >
              <p className="font-body text-sm text-text-muted">
                Connect your wallet to create a canvas
              </p>
              <ConnectButton />
            </div>
          )}

          {/* Form + Preview layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block font-display text-xs text-text mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Pixel Canvas"
                  className="w-full bg-surface border border-grid text-text font-body text-sm px-3 py-2 placeholder:text-text-dim focus:outline-none focus:border-accent"
                  style={{ borderRadius: 0 }}
                />
                {validationErrors.title && (
                  <p className="font-body text-xs text-error mt-1">
                    {validationErrors.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block font-display text-xs text-text mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A collaborative pixel art masterpiece"
                  maxLength={200}
                  rows={3}
                  className="w-full bg-surface border border-grid text-text font-body text-sm px-3 py-2 placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
                  style={{ borderRadius: 0 }}
                />
                <div className="flex justify-between mt-1">
                  {validationErrors.description ? (
                    <p className="font-body text-xs text-error">
                      {validationErrors.description}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="font-body text-xs text-text-dim">
                    {description.length}/200
                  </span>
                </div>
              </div>

              {/* Canvas Size */}
              <div>
                <label className="block font-display text-xs text-text mb-2">
                  Canvas Size
                </label>
                <div className="flex gap-3 items-center mb-2">
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    min={CANVAS_LIMITS.MIN_SIZE}
                    max={CANVAS_LIMITS.MAX_SIZE}
                    className="w-24 bg-surface border border-grid text-text font-body text-sm px-3 py-2 focus:outline-none focus:border-accent"
                    style={{ borderRadius: 0 }}
                  />
                  <span className="font-display text-xs text-text-muted">x</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    min={CANVAS_LIMITS.MIN_SIZE}
                    max={CANVAS_LIMITS.MAX_SIZE}
                    className="w-24 bg-surface border border-grid text-text font-body text-sm px-3 py-2 focus:outline-none focus:border-accent"
                    style={{ borderRadius: 0 }}
                  />
                </div>
                {/* Size presets */}
                <div className="flex gap-2 flex-wrap mb-1">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setWidth(preset.w);
                        setHeight(preset.h);
                      }}
                      className={`font-body text-xs px-3 py-1 border transition-colors ${
                        width === preset.w && height === preset.h
                          ? 'border-accent text-accent bg-surface-alt'
                          : 'border-grid text-text-muted bg-surface hover:border-accent hover:text-accent'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="font-body text-xs text-text-dim">
                  {(width * height).toLocaleString()} pixels
                </p>
                {(validationErrors.width || validationErrors.height) && (
                  <p className="font-body text-xs text-error mt-1">
                    {validationErrors.width || validationErrors.height}
                  </p>
                )}
              </div>

              {/* Cooldown */}
              <div>
                <label className="block font-display text-xs text-text mb-2">
                  Cooldown
                </label>
                <div className="flex gap-3 items-center mb-2">
                  <input
                    type="number"
                    value={cooldown}
                    onChange={(e) => setCooldown(Number(e.target.value))}
                    min={CANVAS_LIMITS.MIN_COOLDOWN}
                    max={CANVAS_LIMITS.MAX_COOLDOWN}
                    className="w-28 bg-surface border border-grid text-text font-body text-sm px-3 py-2 focus:outline-none focus:border-accent"
                    style={{ borderRadius: 0 }}
                  />
                  <span className="font-body text-xs text-text-muted">
                    {formatDuration(cooldown)}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {COOLDOWN_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCooldown(preset.value)}
                      className={`font-body text-xs px-3 py-1 border transition-colors ${
                        cooldown === preset.value
                          ? 'border-accent text-accent bg-surface-alt'
                          : 'border-grid text-text-muted bg-surface hover:border-accent hover:text-accent'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {validationErrors.cooldown && (
                  <p className="font-body text-xs text-error mt-1">
                    {validationErrors.cooldown}
                  </p>
                )}
              </div>

              {/* Auction Start Price */}
              <div>
                <label className="block font-display text-xs text-text mb-2">
                  Auction Start Price (WLC)
                </label>
                <input
                  type="number"
                  value={auctionPrice}
                  onChange={(e) => setAuctionPrice(e.target.value)}
                  step="0.001"
                  min="0"
                  className="w-40 bg-surface border border-grid text-text font-body text-sm px-3 py-2 focus:outline-none focus:border-accent"
                  style={{ borderRadius: 0 }}
                />
                {validationErrors.auctionPrice && (
                  <p className="font-body text-xs text-error mt-1">
                    {validationErrors.auctionPrice}
                  </p>
                )}
              </div>

              {/* Auction Duration */}
              <div>
                <label className="block font-display text-xs text-text mb-2">
                  Auction Duration
                </label>
                <div className="flex gap-3 items-center mb-2">
                  <span className="font-body text-sm text-text-muted">
                    {formatDuration(auctionDuration)}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAuctionDuration(preset.value)}
                      className={`font-body text-xs px-3 py-1 border transition-colors ${
                        auctionDuration === preset.value
                          ? 'border-accent text-accent bg-surface-alt'
                          : 'border-grid text-text-muted bg-surface hover:border-accent hover:text-accent'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {validationErrors.auctionDuration && (
                  <p className="font-body text-xs text-error mt-1">
                    {validationErrors.auctionDuration}
                  </p>
                )}
              </div>

              {/* Transaction error */}
              {error && (
                <div
                  className="bg-surface border border-error p-4"
                  style={{ borderRadius: 0 }}
                >
                  <p className="font-body text-sm text-error">
                    {error.message?.includes('User rejected')
                      ? 'Transaction rejected by user'
                      : error.message || 'Transaction failed'}
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="font-body text-xs text-accent mt-2 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Success message */}
              {isSuccess && canvasId !== null && (
                <div
                  className="bg-surface border border-success p-4"
                  style={{ borderRadius: 0 }}
                >
                  <p className="font-body text-sm text-success">
                    Canvas #{canvasId.toString()} created! Redirecting...
                  </p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitDisabled && !isSuccess}
                className={`font-display text-xs px-8 py-3 ${
                  isSuccess
                    ? 'bg-success text-void cursor-pointer hover:bg-success/80'
                    : isSubmitDisabled
                      ? 'bg-surface-alt text-text-dim border border-grid cursor-not-allowed'
                      : 'bg-accent text-void hover:bg-accent-hover cursor-pointer'
                }`}
                style={{
                  borderRadius: 0,
                  boxShadow: isSubmitDisabled && !isSuccess ? 'none' : 'var(--shadow-pixel-sm)',
                  transition: 'background-color 0.2s steps(3)',
                }}
              >
                {getButtonLabel()}
              </button>
            </form>

            {/* Right: Preview */}
            <div
              className="bg-surface border border-grid p-4"
              style={{ borderRadius: 0 }}
            >
              <h2 className="font-display text-xs text-text-muted mb-4">
                Canvas Preview
              </h2>
              <CanvasPreview width={width} height={height} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
