/**
 * Contract ABI constants for event watching via viem.
 * Event signatures copied exactly from Solidity interfaces.
 */

export const PixelCanvasABI = [
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
  {
    type: 'event',
    name: 'PixelPainted',
    inputs: [
      { name: 'canvasId', type: 'uint256', indexed: true },
      { name: 'painter', type: 'address', indexed: true },
      { name: 'x', type: 'uint16', indexed: false },
      { name: 'y', type: 'uint16', indexed: false },
      { name: 'colorIndex', type: 'uint8', indexed: false },
      { name: 'filledPixels', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CanvasCompleted',
    inputs: [
      { name: 'canvasId', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const CanvasAuctionABI = [
  {
    type: 'event',
    name: 'AuctionStarted',
    inputs: [
      { name: 'canvasId', type: 'uint256', indexed: true },
      { name: 'auctionId', type: 'uint256', indexed: true },
      { name: 'startPrice', type: 'uint256', indexed: false },
      { name: 'endTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BidPlaced',
    inputs: [
      { name: 'auctionId', type: 'uint256', indexed: true },
      { name: 'bidder', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AuctionExtended',
    inputs: [
      { name: 'auctionId', type: 'uint256', indexed: true },
      { name: 'newEndTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AuctionSettled',
    inputs: [
      { name: 'auctionId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const RevenueDistributorABI = [
  {
    type: 'event',
    name: 'RevenueDistributed',
    inputs: [
      { name: 'canvasId', type: 'uint256', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'contributorsShare', type: 'uint256', indexed: false },
      { name: 'proposerShare', type: 'uint256', indexed: false },
      { name: 'platformShare', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawal',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
