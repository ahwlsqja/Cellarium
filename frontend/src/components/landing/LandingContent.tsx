'use client';

import Link from 'next/link';
import PixelBlockBackground from '@/components/background/PixelBlockBackground';

const STEPS = [
  {
    icon: '\u{1F3A8}',
    title: 'Paint',
    description: 'Pick a canvas, choose a color, place pixels',
  },
  {
    icon: '\u{2705}',
    title: 'Complete',
    description: 'Fill every pixel to trigger the auction',
  },
  {
    icon: '\u{1F3C6}',
    title: 'Own',
    description: 'Bid on the NFT and own the collaborative artwork',
  },
] as const;

export default function LandingContent() {
  return (
    <div className="min-h-screen relative">
      {/* Animated background */}
      <PixelBlockBackground />

      {/* Hero section -- full viewport, centered */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        <div
          className="bg-void/80 border border-grid px-8 py-12 sm:px-12 sm:py-16 text-center max-w-xl w-full"
          style={{
            borderRadius: 0,
            boxShadow: 'var(--shadow-pixel)',
          }}
        >
          {/* Cellarium wordmark */}
          <h1 className="font-display text-3xl sm:text-4xl text-accent mb-4">
            Cellarium
          </h1>

          {/* Tagline */}
          <p className="font-body text-lg text-text-muted mb-2">
            Collaborative Pixel Art on Worldland
          </p>

          {/* Subtitle */}
          <p className="font-body text-sm text-text-dim mb-8">
            Paint together. Create together. Own together.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/browse"
              className="inline-block font-display text-xs px-6 py-3 bg-accent text-void hover:bg-accent-hover"
              style={{
                borderRadius: 0,
                boxShadow: 'var(--shadow-pixel-sm)',
                transition: 'background-color 0.2s steps(3)',
              }}
            >
              Browse Canvases
            </Link>
            <Link
              href="/leaderboard"
              className="inline-block font-display text-xs px-6 py-3 border border-accent text-accent hover:bg-accent/10"
              style={{
                borderRadius: 0,
                boxShadow: 'var(--shadow-pixel-sm)',
                transition: 'background-color 0.2s steps(3), border-color 0.2s steps(3)',
              }}
            >
              View Leaderboard
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="mt-12 animate-pixel-blink">
          <span className="font-body text-xs text-text-dim">scroll</span>
        </div>
      </div>

      {/* How it works section */}
      <div className="relative z-10 px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-sm sm:text-base text-text text-center mb-8">
            How it works
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((step, idx) => (
              <div
                key={step.title}
                className="bg-surface/90 border border-grid p-6 text-center"
                style={{
                  borderRadius: 0,
                  boxShadow: 'var(--shadow-pixel-sm)',
                }}
              >
                <div className="font-body text-2xl mb-3">{step.icon}</div>
                <h3 className="font-display text-xs text-accent mb-2">
                  {`${idx + 1}. ${step.title}`}
                </h3>
                <p className="font-body text-sm text-text-muted">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
