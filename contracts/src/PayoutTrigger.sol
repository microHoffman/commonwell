// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

interface IYieldForwarder {
    function reportAndForward(address strategy, uint256 maxLoss) external returns (uint256 assets);
    function forwardToken(address token) external;
}

/// @notice Public keeper for Octant YieldForwarders, so anyone can send a community's payout.
/// @dev Set as the immutable `keeper` of every forwarder. It has no owner, no storage and never
///      holds funds; the forwarder can only pay its fixed receiver.
contract PayoutTrigger {
    /// @notice Reports `strategy` and forwards the donated yield to the forwarder's receiver.
    /// @dev The loss tolerance is fixed at 0, so a caller can never accept a loss on the donation.
    function sendPayout(IYieldForwarder forwarder, address strategy) external returns (uint256 assets) {
        return forwarder.reportAndForward(strategy, 0);
    }

    /// @notice Sends the forwarder's whole balance of `token` to its receiver.
    /// @dev For reward tokens or strategy shares left at the forwarder.
    function forwardToken(IYieldForwarder forwarder, address token) external {
        forwarder.forwardToken(token);
    }
}
