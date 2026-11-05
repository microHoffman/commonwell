// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LidoStrategy } from "octant/strategies/yieldSkimming/LidoStrategy.sol";
import { YieldSkimmingTokenizedStrategy } from "octant/strategies/yieldSkimming/YieldSkimmingTokenizedStrategy.sol";
import { YieldForwarder } from "octant/core/YieldForwarder.sol";
import { PayoutTrigger, IYieldForwarder } from "../src/PayoutTrigger.sol";

/// @dev A LidoStrategy vault: its own functions plus the shared implementation reached through its fallback.
interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner, uint256 maxLoss) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner, uint256 maxLoss) external returns (uint256 assets);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function maxDeposit(address receiver) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);
    function asset() external view returns (address);
    function management() external view returns (address);
    function keeper() external view returns (address);
    function emergencyAdmin() external view returns (address);
    function dragonRouter() external view returns (address);
    function pendingDragonRouter() external view returns (address);
    function enableBurning() external view returns (bool);
    function TOKENIZED_STRATEGY_ADDRESS() external view returns (address);
    function getCurrentExchangeRate() external view returns (uint256);
    function getLastRateRay() external view returns (uint256);
    function isVaultInsolvent() external view returns (bool);
    function report() external returns (uint256 profit, uint256 loss);
    function doHealthCheck() external view returns (bool);
    function setDoHealthCheck(bool doHealthCheck) external;
    function shutdownStrategy() external;
    function setKeeper(address keeper) external;
    function setDragonRouter(address dragonRouter) external;
    function finalizeDragonRouterChange() external;
    function cancelDragonRouterChange() external;
}

interface IMulticall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData);
}

/// @dev Forks Hoodi at a pinned block and deploys everything through the CREATE2 deployer, as deploy-core does.
abstract contract HoodiForkTest is Test {
    address internal constant WSTETH = 0x7E99eE3C66636DE415D2d7C880938F2f40f94De4;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address internal constant MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;
    uint256 internal constant HOODI_FORK_BLOCK = 3_945_000;
    // deploy-core uses the zero salt for the shared contracts, so they get the same address on every network.
    bytes32 internal constant CORE_SALT = bytes32(0);

    struct Community {
        address admin;
        address treasury;
        YieldForwarder forwarder;
        IVault vault;
    }

    address internal implementation;
    PayoutTrigger internal trigger;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal anyone = makeAddr("anyone");

    function setUp() public virtual {
        // Pinned historical state needs an archive node.
        vm.createSelectFork(vm.envOr("HOODI_ARCHIVE_RPC_URL", string("https://rpc.hoodi.ethpandaops.io")), HOODI_FORK_BLOCK);
        implementation = _create2(CORE_SALT, type(YieldSkimmingTokenizedStrategy).creationCode);
        trigger = PayoutTrigger(_create2(CORE_SALT, type(PayoutTrigger).creationCode));
    }

    /// @dev Same call the app makes: the deployer takes `salt ‖ initCode` and returns the new address.
    function _create2(bytes32 salt, bytes memory initCode) internal returns (address deployed) {
        address expected = vm.computeCreate2Address(salt, keccak256(initCode), CREATE2_DEPLOYER);
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(abi.encodePacked(salt, initCode));
        require(ok, "create2 failed");
        deployed = address(bytes20(ret));
        assertEq(deployed, expected, "create2 address");
        assertGt(deployed.code.length, 0, "no code");
    }

    function _forwarderInitCode(address treasury) internal view returns (bytes memory) {
        return abi.encodePacked(type(YieldForwarder).creationCode, abi.encode(treasury, address(trigger)));
    }

    function _vaultInitCode(address admin, address forwarder, string memory name) internal view returns (bytes memory) {
        return
            abi.encodePacked(
                type(LidoStrategy).creationCode,
                abi.encode(WSTETH, name, "cyWSTETH", admin, forwarder, admin, forwarder, false, implementation)
            );
    }

    /// @dev Mirrors the in-app wizard: forwarder first, then the vault wired to it.
    function _deployCommunity(string memory label, bytes32 salt) internal returns (Community memory c) {
        c.admin = makeAddr(string.concat(label, "-admin"));
        c.treasury = makeAddr(string.concat(label, "-treasury"));
        c.forwarder = YieldForwarder(_create2(salt, _forwarderInitCode(c.treasury)));
        c.vault = IVault(_create2(salt, _vaultInitCode(c.admin, address(c.forwarder), string.concat(label, " wstETH"))));
    }

    /// @dev ETH -> wstETH through wstETH's staking shortcut; returns the amount minted.
    function _stake(address user, uint256 eth) internal returns (uint256 received) {
        vm.deal(user, user.balance + eth);
        uint256 before = IERC20(WSTETH).balanceOf(user);
        vm.prank(user);
        (bool ok, ) = WSTETH.call{ value: eth }("");
        require(ok, "stake failed");
        received = IERC20(WSTETH).balanceOf(user) - before;
    }

    function _deposit(Community memory c, address user, uint256 assets) internal returns (uint256 shares) {
        vm.startPrank(user);
        IERC20(WSTETH).approve(address(c.vault), assets);
        shares = c.vault.deposit(assets, user);
        vm.stopPrank();
    }

    /// @dev Anyone can send a payout through the trigger.
    function _payout(Community memory c) internal returns (uint256) {
        vm.prank(anyone);
        return trigger.sendPayout(IYieldForwarder(address(c.forwarder)), address(c.vault));
    }

    /// @dev What the app sends when a vault holds assets but no shares (Octant then blocks deposits):
    ///      two payouts in one Multicall3 transaction. The second leaves a dust share at the forwarder.
    function _reopen(Community memory c) internal {
        bytes memory payout = abi.encodeCall(
            trigger.sendPayout,
            (IYieldForwarder(address(c.forwarder)), address(c.vault))
        );
        IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](2);
        calls[0] = IMulticall3.Call3({ target: address(trigger), allowFailure: false, callData: payout });
        calls[1] = IMulticall3.Call3({ target: address(trigger), allowFailure: false, callData: payout });
        vm.prank(anyone);
        IMulticall3(MULTICALL3).aggregate3(calls);
    }

    function _wsteth(address account) internal view returns (uint256) {
        return IERC20(WSTETH).balanceOf(account);
    }

    /// @dev MOCK: overrides Lido's exchange rate, as Octant's own Lido tests do. Not a live oracle update.
    function _mockRate(uint256 rate) internal {
        vm.mockCall(WSTETH, abi.encodeWithSignature("stEthPerToken()"), abi.encode(rate));
    }

    function _liveRate() internal view returns (uint256) {
        (bool ok, bytes memory ret) = WSTETH.staticcall(abi.encodeWithSignature("stEthPerToken()"));
        require(ok, "rate");
        return abi.decode(ret, (uint256));
    }
}
