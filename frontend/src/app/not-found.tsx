'use client';

import Link from 'next/link';
import PixelBlockBackground from '@/components/background/PixelBlockBackground';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Animated background */}
      <PixelBlockBackground />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-6">
        {/* Decorative scattered pixel squares */}
        <div className="absolute" style={{ top: '20%', left: '15%' }}>
          <div className="w-2 h-2 bg-pixel-red" />
        </div>
        <div className="absolute" style={{ top: '30%', right: '20%' }}>
          <div className="w-2 h-2 bg-pixel-cyan" />
        </div>
        <div className="absolute" style={{ bottom: '25%', left: '25%' }}>
          <div className="w-2 h-2 bg-pixel-yellow" />
        </div>
        <div className="absolute" style={{ top: '15%', right: '30%' }}>
          <div className="w-2 h-2 bg-pixel-green" />
        </div>
        <div className="absolute" style={{ bottom: '35%', right: '15%' }}>
          <div className="w-2 h-2 bg-pixel-pink" />
        </div>

        {/* Content panel */}
        <div
          className="bg-void/80 border border-grid px-8 py-12 sm:px-12 sm:py-16 text-center max-w-md w-full"
          style={{
            borderRadius: 0,
            boxShadow: 'var(--shadow-pixel)',
          }}
        >
          {/* 404 heading */}
          <h1 className="font-display text-3xl sm:text-4xl text-accent mb-4">
            404
          </h1>

          {/* Subtitle */}
          <h2 className="font-display text-lg text-text mb-4">
            Page Not Found
          </h2>

          {/* Description */}
          <p className="font-body text-lg text-text-muted mb-8">
            This pixel hasn&apos;t been painted yet...
          </p>

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-block font-display text-xs px-6 py-3 bg-accent text-void hover:bg-accent-hover"
              style={{
                borderRadius: 0,
                boxShadow: 'var(--shadow-pixel)',
              }}
            >
              Return Home
            </Link>

            <Link
              href="/browse"
              className="inline-block font-body text-sm px-6 py-3 border border-grid text-text-muted hover:text-accent"
              style={{ borderRadius: 0 }}
            >
              Browse Canvases
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
