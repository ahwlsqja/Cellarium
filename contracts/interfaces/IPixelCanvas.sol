// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title IPixelCanvas - Interface for the PixelCanvas contract
/// @notice Defines the canvas lifecycle: creation, painting, cooldown, completion
interface IPixelCanvas {

    // ===== Enums =====

    /// @notice Canvas state machine: Active -> Completed -> Auctioning -> Settled
    enum CanvasState {
        Active,
        Completed,
        Auctioning,
        Settled
    }

    // ===== Structs =====

    /// @notice Canvas data structure
    struct Canvas {
        address proposer;
        string title;
        string description;
        uint16 width;
        uint16 height;
        uint256 totalPixels;
        uint256 filledPixels;
        uint256 cooldownSeconds;
        uint256 auctionStartPrice;
        uint256 auctionDuration;
        uint256 createdAt;
        CanvasState state;
        uint256[] pixelSlots;
    }

    // ===== Events =====

    /// @notice Emitted when a new canvas is created
    event CanvasCreated(
        uint256 indexed canvasId,
        address indexed proposer,
        uint16 width,
        uint16 height,
        string title
    );

    /// @notice Emitted when a pixel is painted
    event PixelPainted(
        uint256 indexed canvasId,
        address indexed painter,
        uint16 x,
        uint16 y,
        uint8 colorIndex,
        uint256 filledPixels
    );

    /// @notice Emitted when a canvas is completed (all pixels filled)
    event CanvasCompleted(
        uint256 indexed canvasId,
        uint256 timestamp
    );

    // ===== Custom Errors =====

    error CanvasNotActive(uint256 canvasId);
    error InvalidCoordinates(uint16 x, uint16 y);
    error InvalidColor(uint8 colorIndex);
    error CooldownNotExpired(uint256 remainingSeconds);
    error InvalidWidth(uint16 width);
    error InvalidHeight(uint16 height);
    error InvalidCooldown(uint256 cooldownSeconds);
    error InvalidAuctionDuration(uint256 auctionDuration);
    error CanvasNotFound(uint256 canvasId);
    error UnauthorizedCaller();
    error InvalidStateTransition(CanvasState current, CanvasState target);

    // ===== State Management =====

    /// @notice Set canvas state (only callable by auction contract)
    /// @param canvasId The canvas ID
    /// @param newState The new state to transition to
    function setCanvasState(uint256 canvasId, CanvasState newState) external;

    // ===== View Functions =====

    /// @notice Get canvas data by ID
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
    );

    /// @notice Get the color index of a pixel
    function getPixel(uint256 canvasId, uint16 x, uint16 y) external view returns (uint8);

    /// @notice Get the number of pixels painted by a contributor on a canvas
    function getContributorPixels(uint256 canvasId, address contributor) external view returns (uint256);

    /// @notice Get the list of all contributors on a canvas
    function getContributorList(uint256 canvasId) external view returns (address[] memory);

    /// @notice Get all raw pixel slot data for a canvas (for SVG generation)
    /// @param canvasId The canvas ID
    /// @return slots The bitpacked pixel data array (32 pixels per uint256)
    /// @return width The canvas width
    /// @return height The canvas height
    function getPixelData(uint256 canvasId) external view returns (
        uint256[] memory slots,
        uint16 width,
        uint16 height
    );
}
