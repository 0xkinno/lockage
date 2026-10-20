// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LockSurvey} from "../src/LockSurvey.sol";
import {LockGate} from "../src/LockGate.sol";
import {LockLedger} from "../src/LockLedger.sol";
import {LockProbe} from "../src/LockProbe.sol";
import {IElysiumBridgeFactory, IGatewayRouter} from "../src/lib/Interfaces.sol";
import {SealedToken, DriftToken, OversizeToken, TaxToken, MintToken} from "../src/demo/DemoTokens.sol";
import {MockBridgeFactory, MockRouter, MockWalletGateway, MockWallet} from "./mocks/Mocks.sol";

abstract contract Base is Test {
    LockSurvey survey;
    LockGate gate;
    LockLedger ledger;
    LockProbe probe;
    MockBridgeFactory factory;
    MockRouter router;
    MockWalletGateway wgw;

    address builder = makeAddr("builder");
    address rahul = makeAddr("rahul");
    address stranger = makeAddr("stranger");

    function setUp() public virtual {
        factory = new MockBridgeFactory();
        wgw = new MockWalletGateway(factory);
        factory.setGateway(address(wgw));
        router = new MockRouter();
        survey = new LockSurvey(IElysiumBridgeFactory(address(factory)));
        ledger = new LockLedger(survey);
        gate = new LockGate(survey, ledger, IGatewayRouter(address(router)), address(wgw));
        probe = new LockProbe();
    }

    /// Register the pair the way the live bridge does after setup: wallet exists and the route points at the wallet gateway.
    function _wire(address token) internal returns (address wallet, address mirror) {
        wallet = factory.createL2Wallet(token);
        mirror = factory.expectedL1Mirror(token);
        wgw.register(token);
        router.setGateway(mirror, address(wgw));
    }

    function _fund(address token, address to, uint256 amt) internal {
        vm.prank(to);
        (bool ok,) = token.call(abi.encodeWithSignature("claim()"));
        ok;
        amt;
    }
}
