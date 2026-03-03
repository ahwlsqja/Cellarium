// Share utility functions for canvas and NFT pages

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

/** Get the full shareable URL for a canvas page */
export function getCanvasShareUrl(canvasId: number): string {
  return `${SITE_URL}/canvas/${canvasId}`;
}

/** Get the full shareable URL for an NFT page */
export function getNFTShareUrl(tokenId: number): string {
  return `${SITE_URL}/nft/${tokenId}`;
}

/** Build a Twitter/X intent URL for sharing */
export function getTwitterIntentUrl(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** Build a Telegram share URL */
export function getTelegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
