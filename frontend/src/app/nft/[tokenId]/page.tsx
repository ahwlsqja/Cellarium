'use client';

import { useParams } from 'next/navigation';
import { NFTDetail } from '@/components/nft/NFTDetail';

export default function NFTDetailPage() {
  const params = useParams();
  const rawId = params?.tokenId;
  const tokenId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;

  if (isNaN(tokenId) || tokenId < 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] mt-14 flex items-center justify-center">
        <div
          className="bg-surface border border-error p-6 text-center"
          style={{ borderRadius: 0 }}
        >
          <p className="font-display text-sm text-error">Invalid Token ID</p>
          <p className="font-body text-sm text-text-muted mt-2">
            Token ID must be a non-negative number.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] mt-14">
      <NFTDetail tokenId={tokenId} />
    </div>
  );
}
