// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPixelCanvas} from "../interfaces/IPixelCanvas.sol";
import {ICanvasAuction} from "../interfaces/ICanvasAuction.sol";
import {PixelStorage} from "../libraries/PixelStorage.sol";
import {ColorPalette} from "../libraries/ColorPalette.sol";

/// @title PixelCanvas - Collaborative pixel art canvas with r/place-style overwriting
/// @notice Handles canvas creation, pixel painting with bitpacked storage, per-canvas cooldown, and completion detection
/// @dev Uses UUPS proxy pattern with ERC-7201 namespaced storage
contract PixelCanvas is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    IPixelCanvas
{
    using PixelStorage for uint256[];

    // ===== Constants =====

    uint16 public constant MIN_CANVAS_SIZE = 4;
    uint16 public constant MAX_CANVAS_SIZE = 256;
    uint256 public constant MIN_COOLDOWN = 10; // 10 seconds
    uint256 public constant MAX_COOLDOWN = 3600; // 1 hour
    uint256 public constant MIN_AUCTION_DURATION = 1 hours;
    uint256 public constant MAX_AUCTION_DURATION = 7 days;

    // ===== ERC-7201 Namespaced Storage =====

    /// @custom:storage-location erc7201:oceanus.storage.PixelCanvas
    struct PixelCanvasStorage {
        uint256 nextCanvasId;
        mapping(uint256 => Canvas) canvases;
        mapping(uint256 => mapping(address => uint256)) lastPaintTime;
        mapping(uint256 => mapping(address => uint256)) contributorPixels;
        mapping(uint256 => address[]) contributorList;
        mapping(uint256 => mapping(address => bool)) isContributor;
        mapping(uint256 => mapping(uint256 => address)) pixelPainters; // canvasId => linearIndex => painter
        address auctionContract; // set by owner after CanvasAuction is deployed
    }

    // keccak256(abi.encode(uint256(keccak256("oceanus.storage.PixelCanvas")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant PIXEL_CANVAS_STORAGE_LOCATION =
        0x1b34fa8bd800624690c089d74a77f18958b02a6cdae745bc4f389e875267c500;

    function _getPixelCanvasStorage() private pure returns (PixelCanvasStorage storage $) {
        assembly {
            $.slot := PIXEL_CANVAS_STORAGE_LOCATION
        }
    }

    // ===== Constructor =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ===== Initializer =====

    /// @notice Initialize the contract (called once via proxy)
    /// @param initialOwner The address that will own the contract
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    // ===== Canvas Creation =====

    /// @notice Create a new canvas with custom parameters
    /// @param title The canvas title
    /// @param description The canvas description
    /// @param width The canvas width (16-256)
    /// @param height The canvas height (16-256)
    /// @param cooldownSeconds The per-canvas cooldown in seconds (10-3600)
    /// @param auctionStartPrice The auction starting price in wei
    /// @param auctionDuration The auction duration in seconds
    /// @return canvasId The ID of the newly created canvas
    function createCanvas(
        string calldata title,
        string calldata description,
        uint16 width,
        uint16 height,
        uint256 cooldownSeconds,
        uint256 auctionStartPrice,
        uint256 auctionDuration
    ) external returns (uint256 canvasId) {
        // Validate dimensions
        if (width < MIN_CANVAS_SIZE || width > MAX_CANVAS_SIZE) revert InvalidWidth(width);
        if (height < MIN_CANVAS_SIZE || height > MAX_CANVAS_SIZE) revert InvalidHeight(height);
        if (cooldownSeconds < MIN_COOLDOWN || cooldownSeconds > MAX_COOLDOWN) revert InvalidCooldown(cooldownSeconds);
        if (auctionDuration < MIN_AUCTION_DURATION || auctionDuration > MAX_AUCTION_DURATION) {
            revert InvalidAuctionDuration(auctionDuration);
        }

        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        canvasId = $.nextCanvasId++;

        Canvas storage canvas = $.canvases[canvasId];
        canvas.proposer = msg.sender;
        canvas.title = title;
        canvas.description = description;
        canvas.width = width;
        canvas.height = height;
        canvas.totalPixels = uint256(width) * uint256(height);
        canvas.cooldownSeconds = cooldownSeconds;
        canvas.auctionStartPrice = auctionStartPrice;
        canvas.auctionDuration = auctionDuration;
        canvas.createdAt = block.timestamp;
        canvas.state = CanvasState.Active;

        // Initialize pixel storage slots
        uint256 slotsNeeded = (canvas.totalPixels + 31) / 32;
        for (uint256 i = 0; i < slotsNeeded; i++) {
            canvas.pixelSlots.push(0);
        }

        emit CanvasCreated(canvasId, msg.sender, width, height, title);
    }

    // ===== Pixel Painting =====

    /// @notice Paint a pixel on an active canvas
    /// @param canvasId The canvas ID
    /// @param x The x coordinate
    /// @param y The y coordinate
    /// @param colorIndex The color index (1-32)
    function paintPixel(uint256 canvasId, uint16 x, uint16 y, uint8 colorIndex) external {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];

        // Validate canvas state
        if (canvas.state != CanvasState.Active) revert CanvasNotActive(canvasId);

        // Validate coordinates
        if (x >= canvas.width || y >= canvas.height) revert InvalidCoordinates(x, y);

        // Validate color
        if (!ColorPalette.isValidColor(colorIndex)) revert InvalidColor(colorIndex);

        // Check per-canvas cooldown
        uint256 lastPaint = $.lastPaintTime[canvasId][msg.sender];
        if (lastPaint != 0 && block.timestamp < lastPaint + canvas.cooldownSeconds) {
            revert CooldownNotExpired(lastPaint + canvas.cooldownSeconds - block.timestamp);
        }

        // Get previous pixel state
        uint256 linearIndex = uint256(y) * uint256(canvas.width) + uint256(x);

        // Handle overwrite: decrement previous painter's count
        uint8 previousColor = canvas.pixelSlots.getPixel(canvas.width, x, y);
        if (previousColor != 0) {
            // Overwriting an existing pixel
            address previousPainter = $.pixelPainters[canvasId][linearIndex];
            if (previousPainter != address(0)) {
                $.contributorPixels[canvasId][previousPainter]--;
            }
        } else {
            // New pixel fill: increment filled count
            canvas.filledPixels++;
        }

        // Set new pixel
        canvas.pixelSlots.setPixel(canvas.width, x, y, colorIndex);
        $.pixelPainters[canvasId][linearIndex] = msg.sender;

        // Update contributor tracking
        if (!$.isContributor[canvasId][msg.sender]) {
            $.isContributor[canvasId][msg.sender] = true;
            $.contributorList[canvasId].push(msg.sender);
        }
        $.contributorPixels[canvasId][msg.sender]++;

        // Update cooldown
        $.lastPaintTime[canvasId][msg.sender] = block.timestamp;

        emit PixelPainted(canvasId, msg.sender, x, y, colorIndex, canvas.filledPixels);

        // Check completion
        if (canvas.filledPixels == canvas.totalPixels) {
            _completeCanvas(canvasId);
        }
    }

    // ===== Internal Functions =====

    /// @notice Mark a canvas as completed and auto-start auction if linked
    /// @param canvasId The canvas ID
    function _completeCanvas(uint256 canvasId) internal {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];

        canvas.state = CanvasState.Completed;
        emit CanvasCompleted(canvasId, block.timestamp);

        // Auto-start auction if auction contract is linked
        if ($.auctionContract != address(0)) {
            ICanvasAuction($.auctionContract).startAuction(canvasId);
        }
    }

    /// @notice Authorize an upgrade (only owner)
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ===== State Management =====

    /// @notice Set canvas state (only callable by auction contract for state transitions)
    /// @param canvasId The canvas ID
    /// @param newState The new state to transition to
    function setCanvasState(uint256 canvasId, CanvasState newState) external {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();

        // Only auction contract can call this
        if (msg.sender != $.auctionContract) revert UnauthorizedCaller();

        Canvas storage canvas = $.canvases[canvasId];
        CanvasState currentState = canvas.state;

        // Only allow valid transitions: Completed -> Auctioning, Auctioning -> Settled
        if (currentState == CanvasState.Completed && newState == CanvasState.Auctioning) {
            canvas.state = newState;
        } else if (currentState == CanvasState.Auctioning && newState == CanvasState.Settled) {
            canvas.state = newState;
        } else {
            revert InvalidStateTransition(currentState, newState);
        }
    }

    // ===== Admin Functions =====

    /// @notice Set the auction contract address
    /// @param _auctionContract The address of the CanvasAuction contract
    function setAuctionContract(address _auctionContract) external onlyOwner {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        $.auctionContract = _auctionContract;
    }

    // ===== View Functions =====

    /// @inheritdoc IPixelCanvas
    function getCanvas(uint256 canvasId) external view returns (
        address proposer,
        string memory title,
        string memory description,
        uint16 width,
        uint16 height,
        uint256 totalPixels,
        uint256 filledPixels,
        uint256 cooldownSeconds,
        uint256 auctionStartPrice,
        uint256 auctionDuration,
        uint256 createdAt,
        CanvasState state
    ) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];
        return (
            canvas.proposer,
            canvas.title,
            canvas.description,
            canvas.width,
            canvas.height,
            canvas.totalPixels,
            canvas.filledPixels,
            canvas.cooldownSeconds,
            canvas.auctionStartPrice,
            canvas.auctionDuration,
            canvas.createdAt,
            canvas.state
        );
    }

    /// @inheritdoc IPixelCanvas
    function getPixel(uint256 canvasId, uint16 x, uint16 y) external view returns (uint8) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];
        if (x >= canvas.width || y >= canvas.height) revert InvalidCoordinates(x, y);
        return canvas.pixelSlots.getPixel(canvas.width, x, y);
    }

    /// @inheritdoc IPixelCanvas
    function getContributorPixels(uint256 canvasId, address contributor) external view returns (uint256) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        return $.contributorPixels[canvasId][contributor];
    }

    /// @inheritdoc IPixelCanvas
    function getContributorList(uint256 canvasId) external view returns (address[] memory) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        return $.contributorList[canvasId];
    }

    /// @notice Get the address of the painter of a specific pixel
    /// @param canvasId The canvas ID
    /// @param x The x coordinate
    /// @param y The y coordinate
    /// @return The address of the painter
    function getPixelPainter(uint256 canvasId, uint16 x, uint16 y) external view returns (address) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];
        if (x >= canvas.width || y >= canvas.height) revert InvalidCoordinates(x, y);
        uint256 linearIndex = uint256(y) * uint256(canvas.width) + uint256(x);
        return $.pixelPainters[canvasId][linearIndex];
    }

    /// @notice Get the current state of a canvas
    /// @param canvasId The canvas ID
    /// @return The canvas state
    function getCanvasState(uint256 canvasId) external view returns (CanvasState) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        return $.canvases[canvasId].state;
    }

    /// @notice Get the total number of canvases created
    /// @return The total canvas count
    function getTotalCanvases() external view returns (uint256) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        return $.nextCanvasId;
    }

    /// @inheritdoc IPixelCanvas
    function getPixelData(uint256 canvasId) external view returns (
        uint256[] memory slots,
        uint16 width,
        uint16 height
    ) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];
        width = canvas.width;
        height = canvas.height;
        uint256 slotsCount = canvas.pixelSlots.length;
        slots = new uint256[](slotsCount);
        for (uint256 i = 0; i < slotsCount; i++) {
            slots[i] = canvas.pixelSlots[i];
        }
    }

    /// @notice Get the remaining cooldown time for a user on a canvas
    /// @param canvasId The canvas ID
    /// @param user The user address
    /// @return The remaining cooldown in seconds (0 if expired)
    function getCooldownRemaining(uint256 canvasId, address user) external view returns (uint256) {
        PixelCanvasStorage storage $ = _getPixelCanvasStorage();
        Canvas storage canvas = $.canvases[canvasId];
        uint256 lastPaint = $.lastPaintTime[canvasId][user];
        if (lastPaint == 0) return 0;
        uint256 expiresAt = lastPaint + canvas.cooldownSeconds;
        if (block.timestamp >= expiresAt) return 0;
        return expiresAt - block.timestamp;
    }
}
