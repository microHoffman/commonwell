// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { YieldForwarder } from "octant/core/YieldForwarder.sol";
import { YieldSkimmingTokenizedStrategy } from "octant/strategies/yieldSkimming/YieldSkimmingTokenizedStrategy.sol";
import { IYieldForwarder } from "../src/PayoutTrigger.sol";
import { HoodiForkTest } from "./HoodiForkTest.sol";

contract MigrationTest is HoodiForkTest {
    Community internal a;
    address internal newTreasury = makeAddr("new-treasury");
    YieldForwarder internal newForwarder;

    function setUp() public override {
        super.setUp();
        a = _deployCommunity("a", bytes32(uint256(1)));
        newForwarder = YieldForwarder(_create2(bytes32(uint256(2)), _forwarderInitCode(newTreasury)));
        _deposit(a, alice, _stake(alice, 5 ether));
    }

    function test_payoutAddressChangeWaitsFourteenDaysAndCanBeCancelled() public {
        vm.prank(a.admin);
        a.vault.setDragonRouter(address(newForwarder));
        assertEq(a.vault.pendingDragonRouter(), address(newForwarder));

        vm.warp(block.timestamp + 14 days - 1);
        vm.expectRevert(bytes("cooldown not elapsed"));
        a.vault.finalizeDragonRouterChange();

        vm.prank(a.admin);
        a.vault.cancelDragonRouterChange();
        assertEq(a.vault.pendingDragonRouter(), address(0));
        vm.expectRevert(bytes("no pending change"));
        a.vault.finalizeDragonRouterChange();
    }

    function test_routineMigrationKeepsPayingAndKeepsHistory() public {
        uint256 rate = a.vault.getCurrentExchangeRate();
        vm.prank(a.admin);
        a.vault.setDragonRouter(address(newForwarder));

        // During the 14 days the old forwarder keeps paying the old treasury.
        _mockRate((rate * 101) / 100); // MOCK +1%
        vm.expectEmit(true, false, false, false, address(a.vault)); // only the payout address
        emit YieldSkimmingTokenizedStrategy.DonationMinted(address(a.forwarder), 0, 0);
        uint256 oldPaid = _payout(a);
        assertGt(oldPaid, 0);
        assertEq(_wsteth(a.treasury), oldPaid);
        assertEq(a.vault.balanceOf(address(a.forwarder)), 0, "old forwarder flushed");

        vm.warp(block.timestamp + 14 days);
        vm.prank(anyone);
        a.vault.finalizeDragonRouterChange();
        vm.prank(a.admin);
        a.vault.setKeeper(address(newForwarder));
        assertEq(a.vault.dragonRouter(), address(newForwarder));

        // The old forwarder can no longer report.
        vm.expectRevert(bytes("!keeper"));
        _payout(a);

        _mockRate((rate * 102) / 100); // MOCK another +1%
        vm.expectEmit(true, false, false, false, address(a.vault)); // only the payout address
        emit YieldSkimmingTokenizedStrategy.DonationMinted(address(newForwarder), 0, 0);
        vm.prank(anyone);
        uint256 newPaid = trigger.sendPayout(IYieldForwarder(address(newForwarder)), address(a.vault));
        assertGt(newPaid, 0);
        assertEq(_wsteth(newTreasury), newPaid);
        assertEq(_wsteth(a.treasury), oldPaid);
    }
}
