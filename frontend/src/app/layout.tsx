import type { Metadata } from 'next';
import { Press_Start_2P, VT323, Pixelify_Sans } from 'next/font/google';
import { Web3Provider } from '@/providers/Web3Provider';
import Header from '@/components/layout/Header';
import './globals.css';

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const pixelifySans = Pixelify_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-accent',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cellarium',
  description: 'Collaborative pixel art on Worldland - Cellarium',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${pressStart2P.variable} ${vt323.variable} ${pixelifySans.variable} bg-void text-text font-body min-h-screen`}
      >
        <Web3Provider>
          <Header />
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
