// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { DepositRouter, IDepositVault } from "../src/DepositRouter.sol";
import { HoodiForkTest } from "./HoodiForkTest.sol";

/// @dev Looks like a vault but holds another asset.
contract OtherAssetVault {
    function asset() external pure returns (address) {
        return address(0xBEEF);
    }
}

contract DepositRouterTest is HoodiForkTest {
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    DepositRouter internal router;
    Community internal a;
    address internal carol;
    uint256 internal carolKey;

    function setUp() public override {
        super.setUp();
        router = DepositRouter(
            _create2(CORE_SALT, abi.encodePacked(type(DepositRouter).creationCode, abi.encode(WSTETH, address(trigger))))
        );
        a = _deployCommunity("a", bytes32(uint256(1)));
        (carol, carolKey) = makeAddrAndKey("carol");
    }

    function _vault(Community memory c) internal pure returns (IDepositVault) {
        return IDepositVault(address(c.vault));
    }

    function _depositEth(address user, uint256 eth) internal returns (uint256 shares) {
        vm.deal(user, user.balance + eth);
        vm.prank(user);
        shares = router.depositEth{ value: eth }(_vault(a));
    }

    function _permit(uint256 key, address owner, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, owner, address(router), value, IERC20Permit(WSTETH).nonces(owner), deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", IERC20Permit(WSTETH).DOMAIN_SEPARATOR(), structHash));
        return vm.sign(key, digest);
    }

    function _assertRouterEmpty() internal view {
        assertEq(address(router).balance, 0, "router ETH");
        assertEq(_wsteth(address(router)), 0, "router wstETH");
        assertEq(IERC20(WSTETH).allowance(address(router), address(a.vault)), 0, "router allowance");
    }

    function test_ethIsStakedAndDepositedForTheCaller() public {
        uint256 held = _stake(alice, 1 ether);
        uint256 ethBefore = alice.balance;
        uint256 shares = _depositEth(alice, 2 ether);

        assertGt(shares, 0);
        assertEq(a.vault.balanceOf(alice), shares);
        // Staked ETH is valued 1:1 in stETH, less Lido's share rounding.
        assertApproxEqAbs(shares, 2 ether, 2);
        assertEq(_wsteth(alice), held, "held wstETH untouched");
        assertEq(alice.balance, ethBefore);
        _assertRouterEmpty();
    }

    function test_strayWstethAtTheRouterIsNeverDeposited() public {
        uint256 stray = _stake(bob, 1 ether);
        vm.prank(bob);
        IERC20(WSTETH).transfer(address(router), stray);

        uint256 shares = _depositEth(alice, 1 ether);
        assertApproxEqAbs(shares, 1 ether, 2);
        assertEq(_wsteth(address(router)), stray);
    }

    function test_wstethPullsExactlyTheApprovedAmount() public {
        uint256 w = _stake(alice, 3 ether);
        vm.startPrank(alice);
        IERC20(WSTETH).approve(address(router), type(uint256).max);
        uint256 shares = router.depositWstEth(_vault(a), w / 3);
        vm.stopPrank();

        assertEq(_wsteth(alice), w - w / 3);
        assertApproxEqAbs(a.vault.previewRedeem(shares), w / 3, 1);
        _assertRouterEmpty();
    }

    function test_wstethWithAPermit() public {
        uint256 w = _stake(carol, 2 ether);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permit(carolKey, carol, w, deadline);

        vm.prank(carol);
        uint256 shares = router.depositWstEthWithPermit(_vault(a), w, deadline, v, r, s);

        assertEq(_wsteth(carol), 0);
        assertApproxEqAbs(a.vault.previewRedeem(shares), w, 1);
        assertEq(IERC20(WSTETH).allowance(carol, address(router)), 0);
        _assertRouterEmpty();
    }

    function test_aFrontRunPermitStillDeposits() public {
        uint256 w = _stake(carol, 2 ether);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permit(carolKey, carol, w, deadline);

        // Someone copies the signature from the mempool and submits it first.
        vm.prank(anyone);
        IERC20Permit(WSTETH).permit(carol, address(router), w, deadline, v, r, s);

        vm.prank(carol);
        uint256 shares = router.depositWstEthWithPermit(_vault(a), w, deadline, v, r, s);
        assertApproxEqAbs(a.vault.previewRedeem(shares), w, 1);
    }

    function test_anInvalidPermitWithoutAllowanceReverts() public {
        uint256 w = _stake(carol, 2 ether);
        uint256 deadline = block.timestamp + 1 hours;
        // Signed by someone else.
        (, uint256 otherKey) = makeAddrAndKey("other");
        (uint8 v, bytes32 r, bytes32 s) = _permit(otherKey, carol, w, deadline);

        vm.prank(carol);
        vm.expectRevert();
        router.depositWstEthWithPermit(_vault(a), w, deadline, v, r, s);

        // Expired.
        (v, r, s) = _permit(carolKey, carol, w, block.timestamp - 1);
        vm.prank(carol);
        vm.expectRevert();
        router.depositWstEthWithPermit(_vault(a), w, block.timestamp - 1, v, r, s);
        assertEq(_wsteth(carol), w);
    }

    function test_noOneCanDepositAnotherUsersApprovedWsteth() public {
        uint256 w = _stake(alice, 1 ether);
        vm.prank(alice);
        IERC20(WSTETH).approve(address(router), type(uint256).max);

        // The router only ever pulls from msg.sender, so Bob's call can't touch Alice's allowance.
        vm.prank(bob);
        vm.expectRevert();
        router.depositWstEth(_vault(a), w);
        assertEq(_wsteth(alice), w);
    }

    function test_reopensAVaultEveryoneLeftAndDepositsInOneCall() public {
        _deposit(a, alice, _stake(alice, 5 ether));
        _mockRate((a.vault.getCurrentExchangeRate() * 101) / 100); // MOCK +1%
        uint256 shares = a.vault.balanceOf(alice);
        vm.prank(alice);
        a.vault.redeem(shares, alice, alice, 0);
        assertEq(a.vault.maxDeposit(bob), 0);

        uint256 bobShares = _depositEth(bob, 1 ether);
        assertGt(bobShares, 0);
        assertEq(a.vault.balanceOf(bob), bobShares);
        assertGt(_wsteth(a.treasury), 0, "leftover yield paid out");
        assertGt(a.vault.balanceOf(address(a.forwarder)), 0, "dust share at the forwarder");
        _assertRouterEmpty();
    }

    function test_aVaultForAnotherAssetIsRejected() public {
        IDepositVault other = IDepositVault(address(new OtherAssetVault()));
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(DepositRouter.WrongAsset.selector);
        router.depositEth{ value: 1 ether }(other);
        assertEq(alice.balance, 1 ether);
    }

    function test_zeroEthIsRejected() public {
        vm.prank(alice);
        vm.expectRevert(DepositRouter.NoValue.selector);
        router.depositEth(_vault(a));
    }

    function test_aPausedVaultRevertsAndKeepsTheEth() public {
        _deposit(a, alice, _stake(alice, 5 ether));
        _mockRate((a.vault.getCurrentExchangeRate() * 9999) / 10000); // MOCK -0.01%: deposits pause
        assertEq(a.vault.maxDeposit(bob), 0);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert();
        router.depositEth{ value: 1 ether }(_vault(a));
        assertEq(bob.balance, 1 ether);
        assertEq(a.vault.balanceOf(bob), 0);
    }

    function test_routerIsBoundToTheSharedTrigger() public view {
        assertEq(address(router.wstETH()), WSTETH);
        assertEq(address(router.trigger()), address(trigger));
    }
}
