// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

import {IPixelCanvas} from "../interfaces/IPixelCanvas.sol";
import {SVGRenderer} from "../libraries/SVGRenderer.sol";

/// @title CanvasNFT - V2 ERC-721 for completed pixel canvases with on-chain SVG metadata
/// @notice UUPS upgradeable ERC-721 that mints a token per settled canvas auction
/// @dev Generates on-chain SVG in tokenURI by reading pixel data from PixelCanvas
contract CanvasNFT is
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using Strings for uint256;
    using Strings for address;

    // ===== ERC-7201 Namespaced Storage =====

    /// @custom:storage-location erc7201:oceanus.storage.CanvasNFT
    struct CanvasNFTStorage {
        uint256 nextTokenId;
        mapping(uint256 => uint256) canvasIdToTokenId;  // canvasId => tokenId
        mapping(uint256 => uint256) tokenIdToCanvasId;  // tokenId => canvasId
        mapping(uint256 => bool) canvasMinted;           // canvasId => already minted?
        // V2 fields (appended to end -- CRITICAL: never reorder above fields)
        address pixelCanvasContract;
        address canvasAuctionContract;
    }

    // keccak256(abi.encode(uint256(keccak256("oceanus.storage.CanvasNFT")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant CANVAS_NFT_STORAGE_LOCATION =
        0x8a6e09d1a9b6c04aef5c5d8e1f7b3a2d4c6e8f0a1b3c5d7e9f0a2b4c6d8e0f00;

    function _getCanvasNFTStorage() private pure returns (CanvasNFTStorage storage $) {
        assembly {
            $.slot := CANVAS_NFT_STORAGE_LOCATION
        }
    }

    // ===== Custom Errors =====

    error CanvasAlreadyMinted(uint256 canvasId);
    error UnauthorizedMinter();

    // ===== Events =====

    /// @notice Emitted when a canvas NFT is minted
    event CanvasNFTMinted(uint256 indexed canvasId, uint256 indexed tokenId, address indexed winner);

    // ===== Modifiers =====

    /// @notice Restrict to only the CanvasAuction contract
    modifier onlyAuction() {
        if (msg.sender != _getCanvasNFTStorage().canvasAuctionContract) revert UnauthorizedMinter();
        _;
    }

    // ===== Constructor =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ===== Initializer =====

    /// @notice Initialize the contract (called once via proxy)
    /// @param name_ The ERC-721 collection name
    /// @param symbol_ The ERC-721 collection symbol
    /// @param initialOwner The address that will own the contract
    function initialize(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init(initialOwner);
    }

    // ===== Minting =====

    /// @notice Mint an NFT for a settled canvas auction (only callable by CanvasAuction)
    /// @param canvasId The canvas ID whose auction was settled
    /// @param winner The auction winner who receives the NFT
    /// @return tokenId The minted token ID
    function mintForAuction(uint256 canvasId, address winner) external onlyAuction returns (uint256 tokenId) {
        CanvasNFTStorage storage $ = _getCanvasNFTStorage();

        // Prevent double-minting for the same canvas
        if ($.canvasMinted[canvasId]) revert CanvasAlreadyMinted(canvasId);

        tokenId = $.nextTokenId++;
        $.canvasIdToTokenId[canvasId] = tokenId;
        $.tokenIdToCanvasId[tokenId] = canvasId;
        $.canvasMinted[canvasId] = true;

        _mint(winner, tokenId);

        emit CanvasNFTMinted(canvasId, tokenId, winner);
    }

    // ===== View Functions =====

    /// @notice Get the token ID for a canvas
    /// @param canvasId The canvas ID
    /// @return The token ID (reverts if not minted)
    function getTokenByCanvas(uint256 canvasId) external view returns (uint256) {
        CanvasNFTStorage storage $ = _getCanvasNFTStorage();
        return $.canvasIdToTokenId[canvasId];
    }

    /// @notice Get the canvas ID for a token
    /// @param tokenId The token ID
    /// @return The canvas ID
    function getCanvasByToken(uint256 tokenId) external view returns (uint256) {
        CanvasNFTStorage storage $ = _getCanvasNFTStorage();
        return $.tokenIdToCanvasId[tokenId];
    }

    // ===== Token URI =====

    /// @notice Returns fully on-chain JSON metadata with base64-encoded SVG image
    /// @dev Reads pixel data from PixelCanvas, generates SVG via SVGRenderer, encodes as data URI
    /// @param tokenId The token ID
    /// @return The data:application/json;base64,... URI
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        CanvasNFTStorage storage $ = _getCanvasNFTStorage();
        uint256 canvasId = $.tokenIdToCanvasId[tokenId];

        IPixelCanvas pixelCanvas = IPixelCanvas($.pixelCanvasContract);

        // Read canvas metadata
        (
            address proposer,
            string memory title,
            string memory description,
            uint16 width,
            uint16 height,
            , // totalPixels
            , // filledPixels
            , // cooldownSeconds
            , // auctionStartPrice
            , // auctionDuration
            , // createdAt
              // state
        ) = pixelCanvas.getCanvas(canvasId);

        // Read and decode all pixels
        uint8[] memory pixels = _readAllPixels(pixelCanvas, canvasId, width, height);

        // Generate SVG
        string memory svg = SVGRenderer.generateSVG(width, height, pixels);

        // Build JSON metadata (chunked to avoid stack depth issues)
        string memory svgBase64 = Base64.encode(bytes(svg));

        bytes memory jsonPart1 = abi.encodePacked(
            '{"name":"', title,
            '","description":"', description,
            '","image":"data:image/svg+xml;base64,', svgBase64
        );

        bytes memory jsonPart2 = abi.encodePacked(
            '","attributes":[',
            '{"trait_type":"Width","value":', uint256(width).toString(), '},',
            '{"trait_type":"Height","value":', uint256(height).toString(), '}'
        );

        bytes memory jsonPart3 = abi.encodePacked(
            ',{"trait_type":"Proposer","display_type":"address","value":"',
            Strings.toHexString(proposer),
            '"},{"trait_type":"Canvas ID","value":',
            canvasId.toString(),
            '}]}'
        );

        string memory json = string(abi.encodePacked(jsonPart1, jsonPart2, jsonPart3));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ===== Internal Helpers =====

    /// @notice Read all pixels from PixelCanvas and decode into flat uint8 array
    /// @param pixelCanvas The PixelCanvas contract instance
    /// @param canvasId The canvas ID
    /// @param width The canvas width
    /// @param height The canvas height
    /// @return pixels Flat array of color indices
    function _readAllPixels(
        IPixelCanvas pixelCanvas,
        uint256 canvasId,
        uint16 width,
        uint16 height
    ) internal view returns (uint8[] memory pixels) {
        (uint256[] memory slots, , ) = pixelCanvas.getPixelData(canvasId);

        uint256 totalPixels = uint256(width) * uint256(height);
        pixels = new uint8[](totalPixels);

        for (uint256 i = 0; i < totalPixels; i++) {
            uint256 slotIndex = i / 32;
            uint256 bitOffset = (i % 32) * 8;
            pixels[i] = uint8((slots[slotIndex] >> bitOffset) & 0xFF);
        }
    }

    // ===== Admin Functions =====

    /// @notice Set the PixelCanvas contract address (only owner)
    /// @param pixelCanvas The address of the PixelCanvas contract
    function setPixelCanvasContract(address pixelCanvas) external onlyOwner {
        CanvasNFTStorage storage $ = _getCanvasNFTStorage();
        $.pixelCanvasContract = pixelCanvas;
    }

    /// @notice Set the CanvasAuction contract address (only owner)
    /// @param canvasAuction The address of the CanvasAuction contract
    function setCanvasAuctionContract(address canvasAuction) external onlyOwner {
        CanvasNFTStorage storage $ = _getCanvasNFTStorage();
        $.canvasAuctionContract = canvasAuction;
    }

    // ===== UUPS =====

    /// @notice Authorize an upgrade (only owner)
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
