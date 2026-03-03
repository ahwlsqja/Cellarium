import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

// DB32 palette colors (matching frontend/src/lib/palette.ts)
const DB32_HEX = [
  '#000000', '#222034', '#45283C', '#663931', '#8F563B',
  '#DF7126', '#D9A066', '#EEC39A', '#FBF236', '#99E550',
  '#6ABE30', '#37946E', '#4B692F', '#524B24', '#323C39',
  '#3F3F74', '#306082', '#5B6EE1', '#639BFF', '#5FCDE4',
  '#CBDBFC', '#FFFFFF', '#9BADB7', '#847E87', '#696A6A',
  '#595652', '#76428A', '#AC3232', '#D95763', '#D77BBA',
  '#8F974A', '#8A6F30', '#000000',
];

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export const alt = 'Cellarium Canvas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300; // 5 min cache

interface ThumbnailData {
  width: number;
  height: number;
  pixels: number[];
}

interface CanvasSummary {
  canvasId: number;
  title: string;
  state: string;
  filledPixels: number;
  totalPixels: number;
}

function getStateLabel(state: string): string {
  switch (state) {
    case 'active': return 'ACTIVE';
    case 'completed': return 'COMPLETED';
    case 'auctioning': return 'AUCTION LIVE';
    case 'settled': return 'SETTLED';
    default: return state.toUpperCase();
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Load font
  let fontData: ArrayBuffer;
  try {
    const fontBuffer = await readFile(join(process.cwd(), 'public/fonts/PressStart2P-Regular.ttf'));
    fontData = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);
  } catch {
    // Fallback: return simple branded image if font fails
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#29adff', fontSize: 48 }}>Cellarium</span>
        </div>
      ),
      { ...size },
    );
  }

  // Fetch canvas data
  let thumbnail: ThumbnailData | null = null;
  let canvasInfo: CanvasSummary | null = null;

  try {
    const [thumbRes, listRes] = await Promise.all([
      fetch(`${WS_URL}/api/canvas/${id}/thumbnail`),
      fetch(`${WS_URL}/api/canvases`),
    ]);

    if (thumbRes.ok) {
      thumbnail = await thumbRes.json();
    }
    if (listRes.ok) {
      const canvases = (await listRes.json()) as CanvasSummary[];
      canvasInfo = canvases.find((c) => c.canvasId === parseInt(id, 10)) ?? null;
    }
  } catch {
    // Graceful fallback
  }

  const title = canvasInfo?.title || `Canvas #${id}`;
  const stateLabel = canvasInfo ? getStateLabel(canvasInfo.state) : '';

  // Render pixel art grid as colored divs
  // For large canvases (>32x32), downsample to 32x32
  const maxRenderSize = 32;
  let renderWidth = thumbnail?.width ?? 16;
  let renderHeight = thumbnail?.height ?? 16;
  let renderPixels = thumbnail?.pixels ?? [];
  let cellSize = 10;

  if (renderWidth > maxRenderSize || renderHeight > maxRenderSize) {
    // Downsample: pick every Nth pixel
    const scaleX = Math.ceil(renderWidth / maxRenderSize);
    const scaleY = Math.ceil(renderHeight / maxRenderSize);
    const newWidth = Math.ceil(renderWidth / scaleX);
    const newHeight = Math.ceil(renderHeight / scaleY);
    const downsampled: number[] = [];
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcIdx = (y * scaleY) * renderWidth + (x * scaleX);
        downsampled.push(renderPixels[srcIdx] ?? 0);
      }
    }
    renderWidth = newWidth;
    renderHeight = newHeight;
    renderPixels = downsampled;
  }

  // Calculate cell size to fit in ~380x380 area
  const maxArtSize = 380;
  cellSize = Math.floor(Math.min(maxArtSize / renderWidth, maxArtSize / renderHeight));
  cellSize = Math.max(2, cellSize);
  const artWidth = cellSize * renderWidth;
  const artHeight = cellSize * renderHeight;

  // Build pixel rows for rendering
  const rows: { color: string; x: number; y: number }[] = [];
  for (let y = 0; y < renderHeight; y++) {
    for (let x = 0; x < renderWidth; x++) {
      const idx = y * renderWidth + x;
      const colorIndex = renderPixels[idx] ?? 0;
      if (colorIndex > 0) {
        rows.push({
          color: DB32_HEX[colorIndex] ?? '#FFFFFF',
          x,
          y,
        });
      }
    }
  }

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
        {/* Canvas artwork */}
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: artWidth,
            height: artHeight,
            background: '#FFFFFF',
            border: '2px solid #222238',
            flexShrink: 0,
          }}
        >
          {rows.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p.x * cellSize,
                top: p.y * cellSize,
                width: cellSize,
                height: cellSize,
                background: p.color,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            color: '#FFFFFF',
            fontSize: 20,
          }}
        >
          {title}
        </div>

        {/* Status badge */}
        {stateLabel && (
          <div
            style={{
              display: 'flex',
              marginTop: 12,
              color: '#FBF236',
              fontSize: 12,
            }}
          >
            {stateLabel}
          </div>
        )}

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
