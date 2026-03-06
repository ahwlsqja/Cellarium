// Source: https://rainbowkit.com/docs/installation
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { worldland } from './chains';

export const config = getDefaultConfig({
  appName: 'Cellarium',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'placeholder',
  chains: [worldland],
  ssr: true, // Required for Next.js App Router
});
