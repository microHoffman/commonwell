// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { YieldForwarder } from "octant/core/YieldForwarder.sol";
import { IYieldForwarder } from "../src/PayoutTrigger.sol";
import { HoodiForkTest } from "./HoodiForkTest.sol";

/// @dev Answers every call the forwarder makes with made-up numbers.
contract FakeStrategy {
    function report() external pure returns (uint256, uint256) {
        return (0, 0);
    }

    function balanceOf(address) external pure returns (uint256) {
        return 1e18;
    }

    function maxRedeem(address) external pure returns (uint256) {
        return 1e18;
    }

    function convertToAssets(uint256) external pure returns (uint256) {
        return 1e18;
    }

    function redeem(uint256, address, address, uint256) external pure returns (uint256) {
        return 1e18;
    }
}

contract PayoutsTest is HoodiForkTest {
    Community internal a;
    Community internal b;

    function setUp() public override {
        super.setUp();
        a = _deployCommunity("a", bytes32(uint256(1)));
        b = _deployCommunity("b", bytes32(uint256(2)));
    }

    function test_eachCommunityGetsItsOwnYield() public {
        uint256 wA = _stake(alice, 10 ether);
        uint256 wB = _stake(bob, 4 ether);
        uint256 rate = a.vault.getCurrentExchangeRate();
        uint256 sharesA = _deposit(a, alice, wA);
        _deposit(b, bob, wB);
        // Shares are stETH value: deposit amount times the exchange rate.
        assertApproxEqAbs(sharesA, (wA * rate) / 1e18, 1);

        // No rate change yet: nothing to pay out.
        assertEq(_payout(a), 0);

        _mockRate((rate * 101) / 100); // MOCK +1%
        uint256 paidA = _payout(a);
        uint256 paidB = _payout(b);
        assertEq(_wsteth(a.treasury), paidA);
        assertEq(_wsteth(b.treasury), paidB);
        assertApproxEqRel(paidA, wA - (wA * 100) / 101, 1e12);
        assertApproxEqRel(paidB, wB - (wB * 100) / 101, 1e12);

        // Paying again without new yield pays nothing.
        assertEq(_payout(a), 0);
        assertEq(_wsteth(a.treasury), paidA);
    }

    function test_yieldLeftByTheLastDepositorStillGoesToTheCommunity() public {
        uint256 wA = _stake(alice, 5 ether);
        uint256 rate = a.vault.getCurrentExchangeRate();
        _deposit(a, alice, wA);

        _mockRate((rate * 101) / 100); // MOCK +1%
        uint256 sharesA = a.vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = a.vault.redeem(sharesA, alice, alice, 0);
        assertEq(a.vault.totalSupply(), 0);
        uint256 leftover = _wsteth(address(a.vault));
        assertApproxEqAbs(out + leftover, wA, 1);

        // Assets without shares block deposits (Octant's guard against share-price manipulation).
        assertEq(a.vault.maxDeposit(bob), 0);

        assertApproxEqAbs(_payout(a), leftover, 1);
        assertApproxEqAbs(_wsteth(a.treasury), leftover, 1);
        // Rounding leaves 1 wei and no shares, so deposits are still blocked...
        assertEq(a.vault.totalSupply(), 0);
        assertGt(a.vault.totalAssets(), 0);
        assertEq(a.vault.maxDeposit(bob), 0);
        // ...until another report mints a dust share the forwarder can't redeem.
        assertEq(_payout(a), 0);
        assertGt(a.vault.totalSupply(), 0);

        // Deposits reopen, and the next depositor gets exactly what they put in.
        assertGt(a.vault.maxDeposit(bob), 0, "deposits reopen");
        uint256 wB = _stake(bob, 2 ether);
        uint256 sharesB = _deposit(a, bob, wB);
        assertApproxEqAbs(a.vault.previewRedeem(sharesB), wB, 1);
        assertEq(_payout(a), 0);

        vm.prank(bob);
        assertApproxEqAbs(a.vault.redeem(sharesB, bob, bob, 0), wB, 1);
    }

    function test_oneTransactionReopensDepositsAfterEveryoneLeaves() public {
        uint256 w = _stake(alice, 5 ether);
        _deposit(a, alice, w);
        _mockRate((a.vault.getCurrentExchangeRate() * 101) / 100); // MOCK +1%
        uint256 shares = a.vault.balanceOf(alice);
        vm.prank(alice);
        a.vault.redeem(shares, alice, alice, 0);
        assertEq(a.vault.maxDeposit(bob), 0);

        _reopen(a);
        assertGt(_wsteth(a.treasury), 0);
        assertGt(a.vault.maxDeposit(bob), 0);
        uint256 wB = _stake(bob, 1 ether);
        assertApproxEqAbs(a.vault.previewRedeem(_deposit(a, bob, wB)), wB, 1);
    }

    function test_sharesFromAManagementReportAreForwardedNextTime() public {
        _deposit(a, alice, _stake(alice, 5 ether));
        _mockRate((a.vault.getCurrentExchangeRate() * 101) / 100); // MOCK +1%

        // Management may report directly; the donation then waits at the forwarder.
        vm.prank(a.admin);
        a.vault.report();
        uint256 waiting = a.vault.balanceOf(address(a.forwarder));
        assertGt(waiting, 0);
        assertEq(_wsteth(a.treasury), 0);

        uint256 paid = _payout(a);
        assertGt(paid, 0);
        assertEq(a.vault.balanceOf(address(a.forwarder)), 0);
        assertEq(_wsteth(a.treasury), paid);
    }

    function test_aFakeStrategyMovesNoFunds() public {
        _deposit(a, alice, _stake(alice, 5 ether));
        uint256 vaultAssets = _wsteth(address(a.vault));
        FakeStrategy fake = new FakeStrategy();

        // Allowed, but it only makes the forwarder emit a junk event.
        vm.expectEmit(address(a.forwarder));
        emit YieldForwarder.YieldForwarded(address(fake), a.treasury, 1e18, 1e18);
        vm.prank(anyone);
        trigger.sendPayout(IYieldForwarder(address(a.forwarder)), address(fake));

        assertEq(_wsteth(a.treasury), 0);
        assertEq(_wsteth(address(a.vault)), vaultAssets);
    }

    function test_forwardTokenOnlyPaysTheTreasury() public {
        uint256 stray = _stake(bob, 1 ether);
        vm.prank(bob);
        IERC20(WSTETH).transfer(address(a.forwarder), stray);

        vm.prank(anyone);
        trigger.forwardToken(IYieldForwarder(address(a.forwarder)), WSTETH);
        assertEq(_wsteth(a.treasury), stray);
        assertEq(_wsteth(address(a.forwarder)), 0);
    }
}
