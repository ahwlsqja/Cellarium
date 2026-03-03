'use client';

import { useState, useCallback } from 'react';
import { getTwitterIntentUrl, getTelegramShareUrl } from '@/lib/share';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

/**
 * Copy Link + X + Telegram share buttons.
 * Grid Communion styling: compact, pixel art aesthetic.
 */
export default function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing if clipboard API unavailable
    }
  }, [url]);

  const shareText = description ? `${title} - ${description}` : title;
  const twitterUrl = getTwitterIntentUrl(url, shareText);
  const telegramUrl = getTelegramShareUrl(url, shareText);

  const buttonClass =
    'font-display text-xs px-3 py-2 bg-surface border border-grid text-text hover:border-accent';
  const buttonStyle = {
    borderRadius: 0,
    transition: 'border-color 0.1s steps(1)',
  } as const;

  return (
    <div
      className="bg-surface border border-grid p-3"
      style={{ borderRadius: 0 }}
    >
      <h3 className="font-display text-xs text-text mb-2">Share</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopyLink}
          className={buttonClass}
          style={buttonStyle}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>

        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
          style={buttonStyle}
        >
          X
        </a>

        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
          style={buttonStyle}
        >
          Telegram
        </a>
      </div>
    </div>
  );
}
