// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { HoodiForkTest } from "./HoodiForkTest.sol";

contract LossTest is HoodiForkTest {
    Community internal a;

    function setUp() public override {
        super.setUp();
        a = _deployCommunity("a", bytes32(uint256(1)));
    }

    function test_aRateDipPausesPayoutsUntilManagementOverridesOnce() public {
        uint256 w = _stake(alice, 5 ether);
        _deposit(a, alice, w);
        uint256 rate = a.vault.getCurrentExchangeRate();

        _mockRate((rate * 9999) / 10000); // MOCK -0.01%
        vm.expectRevert(bytes("!loss"));
        _payout(a);

        // With burning off, a loss leaves depositors under water: deposits close.
        assertTrue(a.vault.isVaultInsolvent());
        assertEq(a.vault.maxDeposit(bob), 0);

        vm.prank(a.admin);
        a.vault.setDoHealthCheck(false);
        assertEq(_payout(a), 0);
        // The override covers exactly one report.
        assertTrue(a.vault.doHealthCheck());

        _mockRate((rate * 9998) / 10000); // MOCK a further dip
        vm.expectRevert(bytes("!loss"));
        _payout(a);

        // Withdrawals still work, pro rata.
        uint256 shares = a.vault.balanceOf(alice);
        vm.prank(alice);
        assertApproxEqAbs(a.vault.redeem(shares, alice, alice, 0), w, 1);
    }

    function test_shutdownOnlyStopsDeposits() public {
        uint256 w = _stake(alice, 4 ether);
        _deposit(a, alice, w / 2);

        vm.prank(a.admin);
        a.vault.shutdownStrategy();
        assertEq(a.vault.maxDeposit(alice), 0);
        vm.prank(alice);
        vm.expectRevert();
        a.vault.deposit(w / 2, alice);

        _mockRate((a.vault.getCurrentExchangeRate() * 101) / 100); // MOCK +1%
        assertGt(_payout(a), 0);

        uint256 shares = a.vault.balanceOf(alice);
        vm.prank(alice);
        assertGt(a.vault.redeem(shares, alice, alice, 0), 0);
    }
}
