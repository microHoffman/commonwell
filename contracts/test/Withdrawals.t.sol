// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { HoodiForkTest } from "./HoodiForkTest.sol";

contract WithdrawalsTest is HoodiForkTest {
    Community internal a;

    function setUp() public override {
        super.setUp();
        a = _deployCommunity("a", bytes32(uint256(1)));
    }

    function test_partialAndFullWithdrawalsAroundAPayout() public {
        uint256 w = _stake(alice, 8 ether);
        uint256 rate = a.vault.getCurrentExchangeRate();
        uint256 shares = _deposit(a, alice, w);

        vm.prank(alice);
        a.vault.withdraw(w / 4, alice, alice, 0);
        assertEq(_wsteth(alice), w / 4);

        uint256 newRate = (rate * 101) / 100;
        _mockRate(newRate); // MOCK +1%
        uint256 donated = _payout(a);

        uint256 remaining = a.vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = a.vault.redeem(remaining, alice, alice, 0);

        // Alice keeps her stETH value; the yield went to the treasury, not back to her.
        assertApproxEqAbs((out * newRate) / 1e18, remaining, 2);
        assertApproxEqAbs(_wsteth(alice) + donated, w, 2);
        assertApproxEqAbs(((w / 4) * rate) / 1e18 + remaining, shares, 2);
        assertEq(a.vault.balanceOf(alice), 0);
    }

    function test_transferredSharesCanBeRedeemedByTheReceiver() public {
        uint256 w = _stake(alice, 3 ether);
        uint256 shares = _deposit(a, alice, w);

        vm.prank(alice);
        a.vault.transfer(bob, shares);
        assertEq(a.vault.maxRedeem(alice), 0);

        vm.prank(bob);
        assertApproxEqAbs(a.vault.redeem(shares, bob, bob, 0), w, 1);
    }

    function test_tinyAmountsRoundSafely() public {
        uint256 w = _stake(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(bytes("ZERO_SHARES"));
        a.vault.deposit(0, alice);

        // 1 wei of wstETH buys 1 share, which is worth less than 1 wei back: unrecoverable dust.
        uint256 dust = _deposit(a, alice, 1);
        assertEq(dust, 1);
        assertEq(a.vault.maxRedeem(alice), 0);
        vm.prank(alice);
        vm.expectRevert(bytes("ERC4626: redeem more than max"));
        a.vault.redeem(dust, alice, alice, 0);

        // Ordinary amounts round-trip to within a wei.
        uint256 shares = _deposit(a, alice, w - 1);
        vm.prank(alice);
        assertApproxEqAbs(a.vault.redeem(shares, alice, alice, 0), w - 1, 1);
    }
}
