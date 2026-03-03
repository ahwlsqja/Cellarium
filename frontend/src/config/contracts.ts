// Source: deployments/worldland.json + server/src/shared/abis/index.ts

export const CONTRACTS = {
  pixelCanvas: {
    address: '0xd3774a5906c3c0309a80aeb3df65d4d25f7192d9' as `0x${string}`,
  },
  canvasAuction: {
    address: '0xaf9b79133ba730f20a747f9510516d898a6a9027' as `0x${string}`,
  },
  revenueDistributor: {
    address: '0xbf39914bafe573132fc0511dbff84ee952dc0b6a' as `0x${string}`,
  },
  canvasNFT: {
    address: '0x2b88a26b942803404007fe03eaa07d3661e64783' as `0x${string}`,
  },
} as const;

// Write ABI for PixelCanvas.createCanvas
export const PixelCanvasWriteABI = [
  {
    type: 'function',
    name: 'createCanvas',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'width', type: 'uint16' },
      { name: 'height', type: 'uint16' },
      { name: 'cooldownSeconds', type: 'uint256' },
      { name: 'auctionStartPrice', type: 'uint256' },
      { name: 'auctionDuration', type: 'uint256' },
    ],
    outputs: [{ name: 'canvasId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

// Event ABI for CanvasCreated log parsing
export const PixelCanvasEventABI = [
  {
    type: 'event',
    name: 'CanvasCreated',
    inputs: [
      { name: 'canvasId', type: 'uint256', indexed: true },
      { name: 'proposer', type: 'address', indexed: true },
      { name: 'width', type: 'uint16', indexed: false },
      { name: 'height', type: 'uint16', indexed: false },
      { name: 'title', type: 'string', indexed: false },
    ],
  },
] as const;

// Read-only ABIs needed by frontend (for useReadContract calls)
export const PixelCanvasReadABI = [
  {
    type: 'function',
    name: 'getCanvas',
    inputs: [{ name: 'canvasId', type: 'uint256' }],
    outputs: [
      { name: 'proposer', type: 'address' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'width', type: 'uint16' },
      { name: 'height', type: 'uint16' },
      { name: 'totalPixels', type: 'uint256' },
      { name: 'filledPixels', type: 'uint256' },
      { name: 'cooldownSeconds', type: 'uint256' },
      { name: 'auctionStartPrice', type: 'uint256' },
      { name: 'auctionDuration', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'state', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCooldownRemaining',
    inputs: [
      { name: 'canvasId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalCanvases',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// PixelCanvas paintPixel ABI (on-chain pixel painting)
export const PixelCanvasPaintABI = [
  {
    type: 'function',
    name: 'paintPixel',
    inputs: [
      { name: 'canvasId', type: 'uint256' },
      { name: 'x', type: 'uint16' },
      { name: 'y', type: 'uint16' },
      { name: 'colorIndex', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// CanvasAuction write ABIs (placeBid, settleAuction, withdrawBidRefund)
export const CanvasAuctionWriteABI = [
  {
    type: 'function',
    name: 'placeBid',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'settleAuction',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawBidRefund',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// CanvasAuction read ABIs (getAuction, getAuctionByCanvas, isAuctionActive, getPendingReturn, constants)
export const CanvasAuctionReadABI = [
  {
    type: 'function',
    name: 'getAuction',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'canvasId', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'startPrice', type: 'uint256' },
          { name: 'highestBid', type: 'uint256' },
          { name: 'highestBidder', type: 'address' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAuctionByCanvas',
    inputs: [{ name: 'canvasId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAuctionActive',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingReturn',
    inputs: [{ name: 'bidder', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_BID_INCREMENT_BPS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ANTI_SNIPE_WINDOW',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// RevenueDistributor read/write ABIs (withdraw, pendingWithdrawal)
export const RevenueDistributorReadWriteABI = [
  {
    type: 'function',
    name: 'withdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pendingWithdrawal',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// CanvasNFT read ABIs (tokenURI, getTokenByCanvas, getCanvasByToken, balanceOf, ownerOf)
export const CanvasNFTReadABI = [
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenByCanvas',
    inputs: [{ name: 'canvasId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCanvasByToken',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;
