// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IRevenueDistributor} from "../interfaces/IRevenueDistributor.sol";
import {IPixelCanvas} from "../interfaces/IPixelCanvas.sol";

/// @title RevenueDistributor - Pull-based revenue distribution with 80/15/5 split
/// @notice Distributes auction proceeds: 80% contributors, 15% proposer, 5% platform
/// @dev Uses UUPS proxy pattern with ERC-7201 namespaced storage. All withdrawals are pull-based.
contract RevenueDistributor is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    IRevenueDistributor
{
    // ===== Constants =====

    /// @notice Contributors receive 80% (8000 basis points)
    uint256 public constant CONTRIBUTORS_BPS = 8000;

    /// @notice Proposer receives 15% (1500 basis points)
    uint256 public constant PROPOSER_BPS = 1500;

    /// @notice Platform receives 5% (500 basis points)
    uint256 public constant PLATFORM_BPS = 500;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ===== ERC-7201 Namespaced Storage =====

    /// @custom:storage-location erc7201:oceanus.storage.RevenueDistributor
    struct RevenueDistributorStorage {
        mapping(address => uint256) pendingWithdrawals;
        address platformFeeRecipient;
        address pixelCanvasContract;
        address canvasAuctionContract;
    }

    // keccak256(abi.encode(uint256(keccak256("oceanus.storage.RevenueDistributor")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REVENUE_DISTRIBUTOR_STORAGE_LOCATION =
        0xa96b7cafd6f3eb584983cd2c832c059ff6aa53b98d69a03e6de7a4b1ff65be00;

    function _getRevenueDistributorStorage() private pure returns (RevenueDistributorStorage storage $) {
        assembly {
            $.slot := REVENUE_DISTRIBUTOR_STORAGE_LOCATION
        }
    }

    // ===== Custom Errors =====

    error Unauthorized();
    error InvalidAddress();

    // ===== Constructor =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ===== Initializer =====

    /// @notice Initialize the contract (called once via proxy)
    /// @param initialOwner The address that will own the contract
    /// @param pixelCanvas The address of the PixelCanvas contract
    /// @param platformFeeRecipient_ The address to receive platform fees
    function initialize(
        address initialOwner,
        address pixelCanvas,
        address platformFeeRecipient_
    ) public initializer {
        if (pixelCanvas == address(0) || platformFeeRecipient_ == address(0)) revert InvalidAddress();

        __Ownable_init(initialOwner);

        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();
        $.pixelCanvasContract = pixelCanvas;
        $.platformFeeRecipient = platformFeeRecipient_;
    }

    // ===== Revenue Distribution =====

    /// @inheritdoc IRevenueDistributor
    function distributeRevenue(uint256 canvasId) external payable {
        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();

        // Only the auction contract can call this
        if (msg.sender != $.canvasAuctionContract) revert Unauthorized();

        uint256 totalAmount = msg.value;

        // Calculate splits
        uint256 platformFee = totalAmount * PLATFORM_BPS / BPS_DENOMINATOR;
        uint256 proposerFee = totalAmount * PROPOSER_BPS / BPS_DENOMINATOR;
        uint256 contributorsShare = totalAmount - platformFee - proposerFee;

        // Credit platform fee recipient
        $.pendingWithdrawals[$.platformFeeRecipient] += platformFee;

        // Credit canvas proposer
        IPixelCanvas pixelCanvas = IPixelCanvas($.pixelCanvasContract);
        (address proposer,,,,,,,,,,, ) = pixelCanvas.getCanvas(canvasId);
        $.pendingWithdrawals[proposer] += proposerFee;

        // Distribute contributors' share proportionally
        address[] memory contributors = pixelCanvas.getContributorList(canvasId);
        uint256 distributedToContributors = 0;

        // Get total filled pixels for proportional calculation
        (,,,,, , uint256 filledPixels,,,,, ) = pixelCanvas.getCanvas(canvasId);

        for (uint256 i = 0; i < contributors.length; i++) {
            uint256 pixels = pixelCanvas.getContributorPixels(canvasId, contributors[i]);
            if (pixels > 0) {
                uint256 share = contributorsShare * pixels / filledPixels;
                $.pendingWithdrawals[contributors[i]] += share;
                distributedToContributors += share;
            }
        }

        // Handle dust (rounding remainder) -- credit to platform
        uint256 dust = contributorsShare - distributedToContributors;
        if (dust > 0) {
            $.pendingWithdrawals[$.platformFeeRecipient] += dust;
        }

        emit RevenueDistributed(canvasId, totalAmount, contributorsShare, proposerFee, platformFee);
    }

    // ===== Withdrawal =====

    /// @inheritdoc IRevenueDistributor
    function withdraw() external nonReentrant {
        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();
        uint256 amount = $.pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        // CEI: zero balance before sending
        $.pendingWithdrawals[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    // ===== View Functions =====

    /// @inheritdoc IRevenueDistributor
    function pendingWithdrawal(address account) external view returns (uint256) {
        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();
        return $.pendingWithdrawals[account];
    }

    /// @notice Get the platform fee recipient address
    /// @return The platform fee recipient address
    function getPlatformFeeRecipient() external view returns (address) {
        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();
        return $.platformFeeRecipient;
    }

    // ===== Admin Functions =====

    /// @notice Set the platform fee recipient address
    /// @param newRecipient The new platform fee recipient address
    function setPlatformFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidAddress();
        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();
        $.platformFeeRecipient = newRecipient;
    }

    /// @notice Set the CanvasAuction contract address
    /// @param canvasAuction The address of the CanvasAuction contract
    function setCanvasAuctionContract(address canvasAuction) external onlyOwner {
        if (canvasAuction == address(0)) revert InvalidAddress();
        RevenueDistributorStorage storage $ = _getRevenueDistributorStorage();
        $.canvasAuctionContract = canvasAuction;
    }

    // ===== UUPS =====

    /// @notice Authorize an upgrade (only owner)
    /// @param newImplementation The address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
