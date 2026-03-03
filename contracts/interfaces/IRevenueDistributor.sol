// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title IRevenueDistributor - Interface for the RevenueDistributor contract
/// @notice Defines pull-based revenue distribution with 80/15/5 split
interface IRevenueDistributor {

    // ===== Events =====

    /// @notice Emitted when a user withdraws their pending balance
    event Withdrawal(
        address indexed account,
        uint256 amount
    );

    /// @notice Emitted when revenue is distributed for a settled auction
    event RevenueDistributed(
        uint256 indexed canvasId,
        uint256 totalAmount,
        uint256 contributorsShare,
        uint256 proposerShare,
        uint256 platformShare
    );

    // ===== Custom Errors =====

    error NothingToWithdraw();
    error TransferFailed();

    // ===== Functions =====

    /// @notice Distribute revenue for a settled auction (called by CanvasAuction)
    /// @param canvasId The canvas ID whose auction was settled
    function distributeRevenue(uint256 canvasId) external payable;

    /// @notice Withdraw pending balance (pull pattern)
    function withdraw() external;

    /// @notice Check the pending withdrawal amount for an account
    function pendingWithdrawal(address account) external view returns (uint256);
}
