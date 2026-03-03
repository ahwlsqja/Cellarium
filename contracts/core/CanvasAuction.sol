// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ICanvasAuction} from "../interfaces/ICanvasAuction.sol";
import {IPixelCanvas} from "../interfaces/IPixelCanvas.sol";
import {IRevenueDistributor} from "../interfaces/IRevenueDistributor.sol";
import {ICanvasNFT} from "../interfaces/ICanvasNFT.sol";

/// @title CanvasAuction - English auction with anti-sniping for completed pixel canvases
/// @notice Handles auction lifecycle: start -> bid -> anti-snipe -> settle
/// @dev Uses UUPS proxy pattern with ERC-7201 namespaced storage. Pull-based refunds for outbid bidders.
contract CanvasAuction is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    ICanvasAuction
{
    // ===== Constants =====

    /// @notice Anti-sniping: bids within this window of auction end trigger extension
    uint256 public constant ANTI_SNIPE_WINDOW = 10 minutes;

    /// @notice Anti-sniping: extension duration when anti-snipe triggers
    uint256 public constant ANTI_SNIPE_EXTENSION = 10 minutes;

    /// @notice Minimum bid increment in basis points (5% = 500 bps)
    uint256 public constant MIN_BID_INCREMENT_BPS = 500;

    // ===== ERC-7201 Namespaced Storage =====

    /// @custom:storage-location erc7201:oceanus.storage.CanvasAuction
    struct CanvasAuctionStorage {
        uint256 nextAuctionId;
        mapping(uint256 => Auction) auctions;
        mapping(uint256 => uint256) canvasToAuction; // canvasId => auctionId
        mapping(uint256 => bool) canvasHasAuction;   // canvasId => bool (separate from mapping default 0)
        mapping(address => uint256) pendingReturns;   // outbid refunds (pull pattern)
        address pixelCanvasContract;
        address revenueDistributorContract;
        // V2 fields (appended to end -- CRITICAL: never reorder above fields)
        address canvasNFTContract;
    }

    // keccak256(abi.encode(uint256(keccak256("oceanus.storage.CanvasAuction")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant CANVAS_AUCTION_STORAGE_LOCATION =
        0xd7c7be3c352a933c8421df41bd03969b1fc03048822e9ad0cdef399ac790b800;

    function _getCanvasAuctionStorage() private pure returns (CanvasAuctionStorage storage $) {
        assembly {
            $.slot := CANVAS_AUCTION_STORAGE_LOCATION
        }
    }

    // ===== Custom Errors =====

    error CanvasNotCompleted(uint256 canvasId);
    error AuctionAlreadyExists(uint256 canvasId);
    error InvalidAddress();
    error NothingToWithdraw();
    error TransferFailed();

    // ===== Events =====

    /// @notice Emitted when an outbid bidder withdraws their refund
    event BidRefundWithdrawn(address indexed bidder, uint256 amount);

    // ===== Constructor =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ===== Initializer =====

    /// @notice Initialize the contract (called once via proxy)
    /// @param initialOwner The address that will own the contract
    /// @param pixelCanvas The address of the PixelCanvas contract
    /// @param revenueDistributor The address of the RevenueDistributor contract
    function initialize(
        address initialOwner,
        address pixelCanvas,
        address revenueDistributor
    ) public initializer {
        if (pixelCanvas == address(0) || revenueDistributor == address(0)) revert InvalidAddress();

        __Ownable_init(initialOwner);

        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        $.pixelCanvasContract = pixelCanvas;
        $.revenueDistributorContract = revenueDistributor;
    }

    // ===== Auction Lifecycle =====

    /// @inheritdoc ICanvasAuction
    function startAuction(uint256 canvasId) external returns (uint256 auctionId) {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        IPixelCanvas pixelCanvas = IPixelCanvas($.pixelCanvasContract);

        // Read canvas data
        (
            , // proposer
            , // title
            , // description
            , // width
            , // height
            , // totalPixels
            , // filledPixels
            , // cooldownSeconds
            uint256 auctionStartPrice,
            uint256 auctionDuration,
            , // createdAt
            IPixelCanvas.CanvasState state
        ) = pixelCanvas.getCanvas(canvasId);

        // Verify canvas is Completed
        if (state != IPixelCanvas.CanvasState.Completed) revert CanvasNotCompleted(canvasId);

        // Verify no existing auction for this canvas
        if ($.canvasHasAuction[canvasId]) revert AuctionAlreadyExists(canvasId);

        // Create auction
        auctionId = $.nextAuctionId++;
        Auction storage auction = $.auctions[auctionId];
        auction.canvasId = canvasId;
        auction.startTime = block.timestamp;
        auction.endTime = block.timestamp + auctionDuration;
        auction.startPrice = auctionStartPrice;
        // highestBid, highestBidder, settled all default to 0/address(0)/false

        $.canvasToAuction[canvasId] = auctionId;
        $.canvasHasAuction[canvasId] = true;

        emit AuctionStarted(canvasId, auctionId, auctionStartPrice, auction.endTime);

        // Transition canvas state to Auctioning
        pixelCanvas.setCanvasState(canvasId, IPixelCanvas.CanvasState.Auctioning);
    }

    /// @inheritdoc ICanvasAuction
    function placeBid(uint256 auctionId) external payable nonReentrant {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        Auction storage auction = $.auctions[auctionId];

        // Validate auction exists and is active
        if (auction.startTime == 0) revert AuctionNotFound(auctionId);
        if (auction.settled) revert AuctionAlreadySettled(auctionId);
        if (block.timestamp >= auction.endTime) revert AuctionNotActive(auctionId);

        // Validate bid amount
        if (auction.highestBid == 0) {
            // First bid: must meet start price
            if (msg.value < auction.startPrice) {
                revert BidTooLow(auction.startPrice, msg.value);
            }
        } else {
            // Subsequent bid: must be >= highestBid + 5% increment
            uint256 minBid = auction.highestBid + (auction.highestBid * MIN_BID_INCREMENT_BPS / 10000);
            if (msg.value < minBid) {
                revert BidTooLow(minBid, msg.value);
            }
        }

        // Credit previous bidder's refund (pull pattern)
        if (auction.highestBidder != address(0)) {
            $.pendingReturns[auction.highestBidder] += auction.highestBid;
        }

        // Update highest bid
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, msg.value);

        // Anti-sniping: extend if bid in last ANTI_SNIPE_WINDOW
        if (auction.endTime - block.timestamp <= ANTI_SNIPE_WINDOW) {
            auction.endTime += ANTI_SNIPE_EXTENSION;
            emit AuctionExtended(auctionId, auction.endTime);
        }
    }

    /// @inheritdoc ICanvasAuction
    function settleAuction(uint256 auctionId) external nonReentrant {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        Auction storage auction = $.auctions[auctionId];

        // Validate
        if (auction.startTime == 0) revert AuctionNotFound(auctionId);
        if (auction.settled) revert AuctionAlreadySettled(auctionId);
        if (block.timestamp < auction.endTime) revert AuctionNotEnded(auctionId);

        // Mark as settled (CEI: state change first)
        auction.settled = true;

        // Transfer funds first (critical path -- must not be blocked)
        if (auction.highestBid > 0) {
            IRevenueDistributor($.revenueDistributorContract).distributeRevenue{value: auction.highestBid}(
                auction.canvasId
            );
        }

        emit AuctionSettled(auctionId, auction.highestBidder, auction.highestBid);

        // Best-effort NFT minting (settlement is already complete at this point)
        if ($.canvasNFTContract != address(0) && auction.highestBidder != address(0)) {
            try ICanvasNFT($.canvasNFTContract).mintForAuction(
                auction.canvasId, auction.highestBidder
            ) {} catch {}
        }

        // Best-effort state update (settlement is already complete at this point)
        try IPixelCanvas($.pixelCanvasContract).setCanvasState(
            auction.canvasId, IPixelCanvas.CanvasState.Settled
        ) {} catch {}
    }

    /// @notice Allows outbid bidders to withdraw their refund (pull pattern)
    function withdrawBidRefund() external nonReentrant {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        uint256 amount = $.pendingReturns[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        // CEI: zero balance before sending
        $.pendingReturns[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit BidRefundWithdrawn(msg.sender, amount);
    }

    // ===== View Functions =====

    /// @inheritdoc ICanvasAuction
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        return $.auctions[auctionId];
    }

    /// @notice Get auction ID for a given canvas
    /// @param canvasId The canvas ID
    /// @return auctionId The auction ID (reverts if no auction exists)
    function getAuctionByCanvas(uint256 canvasId) external view returns (uint256) {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        if (!$.canvasHasAuction[canvasId]) revert AuctionNotFound(0);
        return $.canvasToAuction[canvasId];
    }

    /// @notice Get pending refund amount for an outbid bidder
    /// @param bidder The bidder address
    /// @return The pending refund amount
    function getPendingReturn(address bidder) external view returns (uint256) {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        return $.pendingReturns[bidder];
    }

    /// @notice Check if an auction is currently active (not settled, not ended)
    /// @param auctionId The auction ID
    /// @return True if the auction is active
    function isAuctionActive(uint256 auctionId) external view returns (bool) {
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        Auction storage auction = $.auctions[auctionId];
        return auction.startTime > 0 && !auction.settled && block.timestamp < auction.endTime;
    }

    // ===== Admin Functions =====

    /// @notice Set the PixelCanvas contract address
    /// @param pixelCanvas The address of the PixelCanvas contract
    function setPixelCanvasContract(address pixelCanvas) external onlyOwner {
        if (pixelCanvas == address(0)) revert InvalidAddress();
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        $.pixelCanvasContract = pixelCanvas;
    }

    /// @notice Set the CanvasNFT contract address
    /// @param canvasNFT The address of the CanvasNFT contract
    function setCanvasNFTContract(address canvasNFT) external onlyOwner {
        if (canvasNFT == address(0)) revert InvalidAddress();
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        $.canvasNFTContract = canvasNFT;
    }

    /// @notice Set the RevenueDistributor contract address
    /// @param revenueDistributor The address of the RevenueDistributor contract
    function setRevenueDistributorContract(address revenueDistributor) external onlyOwner {
        if (revenueDistributor == address(0)) revert InvalidAddress();
        CanvasAuctionStorage storage $ = _getCanvasAuctionStorage();
        $.revenueDistributorContract = revenueDistributor;
    }

    // ===== UUPS =====

    /// @notice Authorize an upgrade (only owner)
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
