// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IYieldForwarder, PayoutTrigger } from "./PayoutTrigger.sol";

/// @dev The parts of a lido-wsteth-v1 vault the router uses.
interface IDepositVault {
    function asset() external view returns (address);
    function totalSupply() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function dragonRouter() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

/// @notice Deposits ETH or wstETH into a community vault in one transaction, for the caller.
/// @dev No owner, no storage and nothing held between calls. It only moves `msg.value` or exactly
///      `assets` from `msg.sender`, and shares always go to `msg.sender`. Tokens sent to it by
///      mistake are never used for anyone's deposit.
contract DepositRouter {
    using SafeERC20 for IERC20;

    IERC20 public immutable wstETH;
    PayoutTrigger public immutable trigger;

    error WrongAsset();
    error NoValue();
    error StakeFailed();

    constructor(IERC20 wstETH_, PayoutTrigger trigger_) {
        wstETH = wstETH_;
        trigger = trigger_;
    }

    /// @notice Stakes ETH through wstETH's staking shortcut and deposits exactly the minted wstETH.
    function depositEth(IDepositVault vault) external payable returns (uint256 shares) {
        if (msg.value == 0) revert NoValue();
        uint256 before = wstETH.balanceOf(address(this));
        (bool ok, ) = address(wstETH).call{ value: msg.value }("");
        if (!ok) revert StakeFailed();
        return _deposit(vault, wstETH.balanceOf(address(this)) - before);
    }

    /// @notice Deposits `assets` wstETH the caller has approved to the router.
    function depositWstEth(IDepositVault vault, uint256 assets) external returns (uint256 shares) {
        wstETH.safeTransferFrom(msg.sender, address(this), assets);
        return _deposit(vault, assets);
    }

    /// @notice Same as `depositWstEth`, with an EIP-2612 permit instead of a prior approval.
    /// @dev A permit that fails (e.g. someone submitted it first) is ignored; the transfer then
    ///      succeeds only if the allowance is there anyway.
    function depositWstEthWithPermit(
        IDepositVault vault,
        uint256 assets,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 shares) {
        try IERC20Permit(address(wstETH)).permit(msg.sender, address(this), assets, deadline, v, r, s) {} catch {}
        wstETH.safeTransferFrom(msg.sender, address(this), assets);
        return _deposit(vault, assets);
    }

    function _deposit(IDepositVault vault, uint256 assets) internal returns (uint256 shares) {
        if (vault.asset() != address(wstETH)) revert WrongAsset();
        _reopenIfNeeded(vault);
        wstETH.forceApprove(address(vault), assets);
        return vault.deposit(assets, msg.sender);
    }

    /// @dev Octant blocks deposits while a vault holds assets but no shares (after everyone withdrew).
    ///      Two payouts fix it, as in the app's reopen transaction: the first sends any leftover
    ///      yield, the second leaves a dust share at the forwarder. The trigger is public, so this
    ///      grants nothing the caller couldn't do directly.
    function _reopenIfNeeded(IDepositVault vault) internal {
        if (vault.totalSupply() != 0 || vault.totalAssets() == 0) return;
        IYieldForwarder forwarder = IYieldForwarder(vault.dragonRouter());
        trigger.sendPayout(forwarder, address(vault));
        trigger.sendPayout(forwarder, address(vault));
    }
}
