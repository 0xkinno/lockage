// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LockSurvey} from "../src/LockSurvey.sol";
import {LockGate} from "../src/LockGate.sol";
import {LockLedger} from "../src/LockLedger.sol";
import {IElysiumBridgeFactory, IGatewayRouter, IERC20Meta} from "../src/lib/Interfaces.sol";

/// ArbSys is an Arbitrum precompile that forge does not run. This stand-in lets the real gateway finish.
contract ArbSysStandIn {
    uint256 public sent;

    fallback(bytes calldata) external returns (bytes memory) {
        sent++;
        return abi.encode(sent);
    }
}

/// Runs LockGate against the REAL Elysium testnet factory, router and bridge-wallet gateway on a fork.
/// It answers the question "can a contract call outboundTransfer on the bridge-wallet gateway?" by experiment.
/// Skipped when the RPC is unreachable. This is a fork simulation, not an on-chain transaction.
contract ForkGateTest is Test {
    address constant FACTORY = 0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a;
    address constant ROUTER = 0x89659883a9d980925733B0A698F117AAb65ac718;
    address constant WALLET_GATEWAY = 0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959;
    // a live, routed, immutable-looking 18 decimal token found by the census
    address constant CTR = 0xd5aCdE72FEbeD155EEf81e4bDEe40F23e03B9D19;

    LockSurvey survey;
    LockLedger ledger;
    LockGate gate;
    address user = makeAddr("holder");

    function setUp() public {
        try vm.createSelectFork("elysium") returns (uint256) {}
        catch {
            vm.skip(true);
        }
        vm.etch(address(100), address(new ArbSysStandIn()).code);
        survey = new LockSurvey(IElysiumBridgeFactory(FACTORY));
        ledger = new LockLedger(survey);
        gate = new LockGate(survey, ledger, IGatewayRouter(ROUTER), WALLET_GATEWAY);
    }

    function test_fork_preflight_reads_real_factory_and_router() public {
        vm.prank(user);
        survey.seal(CTR);
        (uint8 code, address mirror, address wallet) = gate.preflight(CTR);
        assertEq(code, 0, "all pre-flight checks pass on a live routed token");
        assertEq(mirror, IElysiumBridgeFactory(FACTORY).expectedL1Mirror(CTR));
        assertEq(wallet, IElysiumBridgeFactory(FACTORY).l2WalletFor(CTR));
        assertTrue(wallet != address(0));
    }

    function test_fork_contract_caller_can_cross_through_real_gateway() public {
        vm.prank(user);
        survey.seal(CTR);
        deal(CTR, user, 500 ether);
        (, , address wallet) = gate.preflight(CTR);
        uint256 before = IERC20Meta(CTR).balanceOf(wallet);

        vm.startPrank(user);
        (bool ok,) = CTR.call(abi.encodeWithSignature("approve(address,uint256)", address(gate), 100 ether));
        assertTrue(ok);
        gate.cross(CTR, 100 ether, user);
        vm.stopPrank();

        assertEq(IERC20Meta(CTR).balanceOf(wallet), before + 100 ether, "real escrow wallet received exactly the amount");
        assertEq(IERC20Meta(CTR).balanceOf(address(gate)), 0, "gate holds nothing");
        assertEq(IERC20Meta(CTR).balanceOf(user), 400 ether);
    }

    function test_fork_unsealed_token_is_refused_by_real_stack() public {
        deal(CTR, user, 10 ether);
        vm.startPrank(user);
        (bool ok,) = CTR.call(abi.encodeWithSignature("approve(address,uint256)", address(gate), 10 ether));
        ok;
        vm.expectRevert(LockGate.NotSealed.selector);
        gate.cross(CTR, 10 ether, user);
        vm.stopPrank();
    }
}
