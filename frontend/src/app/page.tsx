import type { Metadata } from 'next';
import LandingContent from '@/components/landing/LandingContent';

export const metadata: Metadata = {
  title: 'Cellarium - Collaborative Pixel Art on Worldland',
  description:
    'Paint together. Create together. Own together. Collaborative pixel art canvases minted as NFTs on the Worldland blockchain.',
};

export default function Home() {
  return <LandingContent />;
}
