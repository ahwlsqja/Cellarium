// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title ICanvasNFT - Interface for the CanvasNFT contract
/// @notice Defines the cross-contract interface for NFT minting from auctions
interface ICanvasNFT {

    // ===== Events =====

    /// @notice Emitted when a canvas NFT is minted
    event CanvasNFTMinted(uint256 indexed canvasId, uint256 indexed tokenId, address indexed winner);

    // ===== Custom Errors =====

    error CanvasAlreadyMinted(uint256 canvasId);
    error UnauthorizedMinter();

    // ===== Functions =====

    /// @notice Mint an NFT for a settled canvas auction
    /// @param canvasId The canvas ID whose auction was settled
    /// @param winner The auction winner who receives the NFT
    /// @return tokenId The minted token ID
    function mintForAuction(uint256 canvasId, address winner) external returns (uint256 tokenId);
}
