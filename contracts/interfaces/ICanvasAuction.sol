// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title ICanvasAuction - Interface for the CanvasAuction contract
/// @notice Defines the English auction lifecycle with anti-sniping extension
interface ICanvasAuction {

    // ===== Structs =====

    /// @notice Auction data structure
    struct Auction {
        uint256 canvasId;
        uint256 startTime;
        uint256 endTime;
        uint256 startPrice;
        uint256 highestBid;
        address highestBidder;
        bool settled;
    }

    // ===== Events =====

    /// @notice Emitted when an auction starts
    event AuctionStarted(
        uint256 indexed canvasId,
        uint256 indexed auctionId,
        uint256 startPrice,
        uint256 endTime
    );

    /// @notice Emitted when a bid is placed
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    /// @notice Emitted when an auction is extended due to anti-sniping
    event AuctionExtended(
        uint256 indexed auctionId,
        uint256 newEndTime
    );

    /// @notice Emitted when an auction is settled
    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 amount
    );

    // ===== Custom Errors =====

    error AuctionNotActive(uint256 auctionId);
    error AuctionNotEnded(uint256 auctionId);
    error AuctionAlreadySettled(uint256 auctionId);
    error BidTooLow(uint256 minBid, uint256 actualBid);
    error AuctionNotFound(uint256 auctionId);

    // ===== Functions =====

    /// @notice Start an auction for a completed canvas
    function startAuction(uint256 canvasId) external returns (uint256 auctionId);

    /// @notice Place a bid on an active auction
    function placeBid(uint256 auctionId) external payable;

    /// @notice Settle a completed auction
    function settleAuction(uint256 auctionId) external;

    /// @notice Get auction data by ID
    function getAuction(uint256 auctionId) external view returns (Auction memory);
}
