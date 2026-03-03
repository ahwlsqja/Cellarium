import type { Metadata } from 'next';
import { NFTGallery } from '@/components/nft/NFTGallery';

export const metadata: Metadata = {
  title: 'My NFTs | Cellarium',
  description: 'View your owned canvas NFTs on Cellarium',
};

export default function NFTPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] mt-14 p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="font-display text-lg text-text">My NFTs</h1>
        <NFTGallery />
      </div>
    </div>
  );
}
