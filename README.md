# Cellarium

Collaborative Pixel Art NFT Platform on Worldland Blockchain

## Overview

Cellarium is a collaborative pixel art platform where users paint canvases together, and completed artworks are minted as NFTs through on-chain auctions. Built on the Worldland blockchain.

### Features

- **Collaborative Painting** — Multiple users paint on shared pixel canvases in real-time
- **On-chain Pixels** — Every pixel placement is recorded on-chain via smart contracts
- **Automatic Auctions** — Completed canvases trigger 24h NFT auctions
- **Revenue Sharing** — Auction proceeds distributed to pixel contributors
- **Timelapse** — Watch how canvases were painted over time
- **Leaderboard** — Top painters ranked by contribution

## Architecture

```
contracts/       Solidity smart contracts (Hardhat)
frontend/        Next.js 15 frontend (App Router)
server/          NestJS real-time server (Socket.IO + chain indexer)
scripts/         Deploy & upgrade scripts
deployments/     Chain deployment addresses
```

### Smart Contracts

| Contract | Description |
|---|---|
| `PixelCanvas` | Canvas creation, pixel painting, cooldowns (UUPS upgradeable) |
| `CanvasAuction` | English auction with anti-snipe extension |
| `CanvasNFT` | On-chain SVG NFT minting |
| `RevenueDistributor` | Proportional revenue split to painters |

### Tech Stack

- **Chain**: Worldland (EVM-compatible, chainId 103)
- **Contracts**: Solidity + OpenZeppelin + Hardhat
- **Frontend**: Next.js 15, Tailwind CSS v4, RainbowKit, wagmi/viem
- **Backend**: NestJS, Socket.IO, Supabase (persistence)
- **Fonts**: Press Start 2P, VT323, Pixelify Sans

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm

### Install

```bash
pnpm install
```

### Environment Variables

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

**Server** (`server/.env`):
```
WORLDLAND_RPC=https://seoul.worldland.foundation
PIXELCANVAS_ADDRESS=0x...
CANVASAUCTION_ADDRESS=0x...
CANVASNFT_ADDRESS=0x...
REVENUEDISTRIBUTOR_ADDRESS=0x...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
```

### Run

```bash
# Server
cd server && pnpm run start:dev

# Frontend
cd frontend && pnpm run dev
```

## Deployed Contracts (Worldland)

See `deployments/worldland.json` for current contract addresses.

## License

MIT
