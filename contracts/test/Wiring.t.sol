// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { YieldForwarder } from "octant/core/YieldForwarder.sol";
import { IYieldForwarder } from "../src/PayoutTrigger.sol";
import { HoodiForkTest, IMulticall3 } from "./HoodiForkTest.sol";

contract WiringTest is HoodiForkTest {
    Community internal a;

    function setUp() public override {
        super.setUp();
        a = _deployCommunity("a", bytes32(uint256(1)));
    }

    function test_rolesAreWiredAsTheAppExpects() public view {
        assertEq(a.forwarder.keeper(), address(trigger));
        assertEq(a.forwarder.receiver(), a.treasury);
        assertEq(a.vault.keeper(), address(a.forwarder));
        assertEq(a.vault.dragonRouter(), address(a.forwarder));
        assertEq(a.vault.management(), a.admin);
        assertEq(a.vault.emergencyAdmin(), a.admin);
        assertEq(a.vault.asset(), WSTETH);
        assertEq(a.vault.TOKENIZED_STRATEGY_ADDRESS(), implementation);
        assertFalse(a.vault.enableBurning());
    }

    function test_onlyTheTriggerCanSendPayouts() public {
        _deposit(a, alice, _stake(alice, 1 ether));

        vm.prank(anyone);
        vm.expectRevert(YieldForwarder.OnlyKeeper.selector);
        a.forwarder.reportAndForward(address(a.vault), 0);

        IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](1);
        calls[0] = IMulticall3.Call3({
            target: address(a.forwarder),
            allowFailure: false,
            callData: abi.encodeCall(YieldForwarder.reportAndForward, (address(a.vault), 0))
        });
        vm.prank(anyone);
        vm.expectRevert(bytes("Multicall3: call failed"));
        IMulticall3(MULTICALL3).aggregate3(calls);

        vm.prank(anyone);
        trigger.sendPayout(IYieldForwarder(address(a.forwarder)), address(a.vault));
    }

    function test_vaultWithoutDepositsCannotReport() public {
        assertEq(a.vault.getLastRateRay(), 0);
        vm.expectRevert(bytes("!profit"));
        _payout(a);
    }

    /// @dev Same inputs as packages/core/test/create2.test.ts: Solidity and the app must derive the
    ///      same addresses from the same frozen code.
    function test_create2AddressesMatchTheApp() public view {
        assertEq(implementation, 0x658481F96384B6274FA4cA69D2CFEA251F477C28);
        assertEq(address(trigger), 0xF528D6a0e1361d0d68b4f6a390DB70e460e3D985);
        address owner = address(0x2222);
        bytes32 salt = bytes32(uint256(1));
        address forwarder = vm.computeCreate2Address(salt, keccak256(_forwarderInitCode(address(0x1111))), CREATE2_DEPLOYER);
        assertEq(forwarder, 0x2007c22c03B265AC16d57E52860A6471e0f5884A);
        address vault = vm.computeCreate2Address(salt, keccak256(_vaultInitCode(owner, forwarder, "Vector")), CREATE2_DEPLOYER);
        assertEq(vault, 0x36feBc4E9d1cb50902285bC502c0BA0B8E7E6134);
    }

    function test_differentSettingsGiveDifferentAddresses() public view {
        address other = vm.computeCreate2Address(
            bytes32(uint256(1)),
            keccak256(_vaultInitCode(a.admin, address(a.forwarder), "b wstETH")),
            CREATE2_DEPLOYER
        );
        assertTrue(other != address(a.vault));
    }
}
