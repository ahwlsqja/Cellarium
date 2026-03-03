import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createPublicClient, http } from 'viem';
import { CONTRACTS, CanvasNFTReadABI } from '@/config/contracts';
import { worldland } from '@/config/chains';

export const alt = 'Cellarium NFT';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600; // 1 hour -- NFT metadata doesn't change

/** Truncate address to 0x1234...5678 format */
function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface NFTJsonMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: { trait_type: string; value: string }[];
}

export default async function Image({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = parseInt(tokenIdStr, 10);

  // Load font
  let fontData: ArrayBuffer;
  try {
    const fontBuffer = await readFile(join(process.cwd(), 'public/fonts/PressStart2P-Regular.ttf'));
    fontData = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);
  } catch {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#29adff', fontSize: 48 }}>Cellarium</span>
        </div>
      ),
      { ...size },
    );
  }

  // Read on-chain data using viem directly (no wagmi in server components)
  let nftName = `NFT #${tokenId}`;
  let ownerAddr = '';

  try {
    const client = createPublicClient({
      chain: worldland,
      transport: http(),
    });

    const [tokenURI, owner] = await Promise.all([
      client.readContract({
        address: CONTRACTS.canvasNFT.address,
        abi: CanvasNFTReadABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      }) as Promise<string>,
      client.readContract({
        address: CONTRACTS.canvasNFT.address,
        abi: CanvasNFTReadABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      }) as Promise<string>,
    ]);

    ownerAddr = owner;

    // Decode base64 JSON tokenURI
    const prefix = 'data:application/json;base64,';
    if (tokenURI.startsWith(prefix)) {
      const base64 = tokenURI.slice(prefix.length);
      const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as NFTJsonMetadata;
      nftName = json.name ?? nftName;
    }
  } catch {
    // Contract read failed -- render fallback
  }

  // For the OG image, we can't embed SVG data URIs directly in Satori.
  // Instead, show the NFT name, owner, and Cellarium branding with a styled card.
  // SVG rendering in Satori is limited, so we'll create a visually appealing text-based card.

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#0a0a0f',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Press Start 2P"',
          padding: '40px',
        }}
      >
        {/* NFT card frame */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid #29adff',
            padding: '40px 60px',
            background: '#12121a',
          }}
        >
          {/* Pixel art decoration - top border */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
            {['#DF7126', '#FBF236', '#99E550', '#5FCDE4', '#D95763', '#76428A', '#639BFF', '#D9A066'].map((c, i) => (
              <div key={i} style={{ width: 16, height: 16, background: c }} />
            ))}
          </div>

          {/* NFT name */}
          <div
            style={{
              display: 'flex',
              color: '#FFFFFF',
              fontSize: 24,
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            {nftName}
          </div>

          {/* Owner */}
          {ownerAddr && (
            <div
              style={{
                display: 'flex',
                marginTop: 16,
                color: '#9BADB7',
                fontSize: 12,
              }}
            >
              Owner: {truncateAddress(ownerAddr)}
            </div>
          )}

          {/* Pixel art decoration - bottom border */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '24px' }}>
            {['#639BFF', '#D77BBA', '#AC3232', '#6ABE30', '#EEC39A', '#5B6EE1', '#37946E', '#D95763'].map((c, i) => (
              <div key={i} style={{ width: 16, height: 16, background: c }} />
            ))}
          </div>
        </div>

        {/* Cellarium branding */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 30,
            color: '#29adff',
            fontSize: 14,
          }}
        >
          Cellarium
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Press Start 2P',
          data: fontData,
          style: 'normal',
          weight: 400,
        },
      ],
    },
  );
}
