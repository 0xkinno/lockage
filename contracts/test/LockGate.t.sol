// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {LockGate} from "../src/LockGate.sol";
import {SealedToken, DriftToken, TaxToken, MintToken} from "../src/demo/DemoTokens.sol";
import {MockWallet, MockWalletGateway, ReentrantToken, NoReturnToken, LiarToken} from "./mocks/Mocks.sol";

interface IClaim {
    function claim() external;
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function setSymbol(string calldata) external;
}

contract LockGateTest is Base {
    SealedToken sealed_;
    DriftToken drift;
    address wallet;
    address mirror;

    function setUp() public override {
        super.setUp();
        sealed_ = new SealedToken();
        vm.prank(builder);
        survey.seal(address(sealed_));
        (wallet, mirror) = _wire(address(sealed_));
        vm.prank(rahul);
        sealed_.claim();
        vm.prank(rahul);
        sealed_.approve(address(gate), type(uint256).max);
    }

    function test_cross_happy_path_escrow_exact() public {
        vm.prank(rahul);
        gate.cross(address(sealed_), 100 ether, rahul);
        assertEq(sealed_.balanceOf(wallet), 100 ether);
        assertEq(sealed_.balanceOf(rahul), 900 ether);
        assertEq(sealed_.balanceOf(address(gate)), 0, "gate holds nothing");
        assertEq(sealed_.allowance(address(gate), wallet), 0, "no dangling approval");
    }

    function test_cross_emits_crossed() public {
        vm.expectEmit(true, true, true, true, address(gate));
        emit LockGate.Crossed(address(sealed_), rahul, stranger, 5 ether, mirror);
        vm.prank(rahul);
        gate.cross(address(sealed_), 5 ether, stranger);
    }

    function test_cross_not_sealed_reverts() public {
        SealedToken other = new SealedToken();
        _wire(address(other));
        vm.expectRevert(LockGate.NotSealed.selector);
        gate.cross(address(other), 1 ether, rahul);
    }

    function test_cross_zero_amount_reverts() public {
        vm.prank(rahul);
        vm.expectRevert(LockGate.ZeroAmount.selector);
        gate.cross(address(sealed_), 0, rahul);
    }

    function test_cross_zero_recipient_reverts() public {
        vm.prank(rahul);
        vm.expectRevert(LockGate.ZeroRecipient.selector);
        gate.cross(address(sealed_), 1 ether, address(0));
    }

    function test_cross_pair_not_deployed_reverts() public {
        SealedToken other = new SealedToken();
        survey.seal(address(other));
        vm.expectRevert(LockGate.PairNotDeployed.selector);
        gate.cross(address(other), 1 ether, rahul);
    }

    function test_cross_route_not_registered_reverts() public {
        SealedToken other = new SealedToken();
        survey.seal(address(other));
        factory.createL2Wallet(address(other));
        vm.expectRevert(abi.encodeWithSelector(LockGate.RouteNotRegistered.selector, address(0)));
        gate.cross(address(other), 1 ether, rahul);
    }

    function test_cross_route_points_elsewhere_reverts() public {
        SealedToken other = new SealedToken();
        survey.seal(address(other));
        factory.createL2Wallet(address(other));
        router.setGateway(factory.expectedL1Mirror(address(other)), address(0xBEEF));
        vm.expectRevert(abi.encodeWithSelector(LockGate.RouteNotRegistered.selector, address(0xBEEF)));
        gate.cross(address(other), 1 ether, rahul);
    }

    function test_counterfactual_drift_baseline_control_intervention() public {
        // Baseline: raw route accepts a crossing on the old mirror even after a rename.
        drift = new DriftToken();
        vm.prank(builder);
        survey.seal(address(drift));
        bytes32 sealedHash = survey.metaHash(address(drift));
        (address w, address oldMirror) = _wire(address(drift));
        vm.prank(rahul);
        drift.claim();
        vm.prank(rahul);
        drift.approve(w, type(uint256).max);
        // control: gate crossing succeeds before the rename
        vm.prank(rahul);
        drift.approve(address(gate), type(uint256).max);
        vm.prank(rahul);
        gate.cross(address(drift), 10 ether, rahul);
        assertEq(drift.balanceOf(w), 10 ether);

        drift.setSymbol("LDRIFT2");
        address newMirror = factory.expectedL1Mirror(address(drift));
        assertTrue(newMirror != oldMirror, "rename moves the canonical mirror");

        // raw route keyed on the old mirror still pulls funds
        vm.prank(rahul);
        router.outboundTransfer(oldMirror, rahul, 10 ether, 0, 0, "");
        assertEq(drift.balanceOf(w), 20 ether, "raw route accepted the stale mirror");

        // intervention: gate refuses before any funds move
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.MetadataDrift.selector, sealedHash, survey.metaHash(address(drift))));
        gate.cross(address(drift), 10 ether, rahul);
    }

    function test_drift_revert_carries_hashes() public {
        drift = new DriftToken();
        vm.prank(builder);
        survey.seal(address(drift));
        _wire(address(drift));
        bytes32 sealedHash = survey.metaHash(address(drift));
        drift.setName("Renamed");
        bytes32 liveHash = survey.metaHash(address(drift));
        vm.prank(rahul);
        drift.claim();
        vm.prank(rahul);
        drift.approve(address(gate), type(uint256).max);
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.MetadataDrift.selector, sealedHash, liveHash));
        gate.cross(address(drift), 1 ether, rahul);
        assertEq(drift.balanceOf(rahul), 1_000 ether, "no funds moved");
    }

    function test_drift_then_reseal_then_cross_needs_new_pair() public {
        drift = new DriftToken();
        vm.prank(builder);
        survey.seal(address(drift));
        _wire(address(drift));
        drift.setSymbol("LDRIFT2");
        vm.prank(builder);
        survey.seal(address(drift)); // builder accepts the new identity
        vm.prank(rahul);
        drift.claim();
        vm.prank(rahul);
        drift.approve(address(gate), type(uint256).max);
        // new mirror has no registered route yet
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.RouteNotRegistered.selector, address(0)));
        gate.cross(address(drift), 1 ether, rahul);
    }

    function test_hold_blocks_crossing_and_ack_releases() public {
        bytes32 f = keccak256("finding");
        vm.prank(builder);
        ledger.hold(address(sealed_), f, "books drifting");
        vm.prank(rahul);
        vm.expectRevert(LockGate.OnHold.selector);
        gate.cross(address(sealed_), 1 ether, rahul);
        vm.prank(builder);
        ledger.acknowledge(address(sealed_), f);
        vm.prank(rahul);
        gate.cross(address(sealed_), 1 ether, rahul);
    }

    function test_supply_growth_breaks_envelope() public {
        MintToken m = new MintToken();
        vm.prank(builder);
        survey.seal(address(m));
        _wire(address(m));
        m.claim();
        m.approve(address(gate), type(uint256).max);
        m.mint(address(this), 300_000_000_000_000 ether); // push supply past the ceiling
        vm.expectRevert(LockGate.EnvelopeBroken.selector);
        gate.cross(address(m), 1 ether, rahul);
    }

    function test_tax_token_reverts_with_shortfall() public {
        TaxToken t = new TaxToken();
        survey.seal(address(t));
        _wire(address(t));
        vm.prank(rahul);
        t.claim(); // claim comes from the reservoir, untaxed
        vm.prank(rahul);
        t.approve(address(gate), type(uint256).max);
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.EscrowShortfall.selector, 100 ether, 99 ether));
        gate.cross(address(t), 100 ether, rahul);
        assertEq(t.balanceOf(rahul), 1_000 ether, "revert leaves the holder whole");
    }

    function test_short_change_wallet_reverts() public {
        MockWallet(wallet).setShortChange(true);
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.EscrowShortfall.selector, 10 ether, 10 ether - 1));
        gate.cross(address(sealed_), 10 ether, rahul);
    }

    function test_no_return_token_works() public {
        NoReturnToken n = new NoReturnToken();
        survey.seal(address(n));
        (address w,) = _wire(address(n));
        n.mintTo(rahul, 50 ether);
        vm.prank(rahul);
        n.approve(address(gate), 50 ether);
        vm.prank(rahul);
        gate.cross(address(n), 50 ether, rahul);
        assertEq(n.balanceOf(w), 50 ether);
    }

    function test_reentrancy_into_cross_blocked() public {
        ReentrantToken r = new ReentrantToken();
        survey.seal(address(r));
        _wire(address(r));
        r.mintTo(rahul, 10 ether);
        vm.prank(rahul);
        r.approve(address(gate), 10 ether);
        r.arm(address(gate), abi.encodeCall(LockGate.cross, (address(r), 1 ether, rahul)));
        vm.prank(rahul);
        gate.cross(address(r), 1 ether, rahul);
        assertFalse(r.reentrySucceeded(), "reentrant call refused");
    }

    function test_liar_token_flip_is_caught_as_drift() public {
        LiarToken l = new LiarToken();
        survey.seal(address(l));
        _wire(address(l));
        l.mintTo(rahul, 5 ether);
        bytes32 sealedHash = survey.metaHash(address(l));
        l.flip(); // decimals now disagree with the seal
        bytes32 liveHash = survey.metaHash(address(l));
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.MetadataDrift.selector, sealedHash, liveHash));
        gate.cross(address(l), 1 ether, rahul);
    }

    function test_preflight_codes() public {
        (uint8 c,,) = gate.preflight(address(sealed_));
        assertEq(c, 0);

        SealedToken u = new SealedToken();
        (c,,) = gate.preflight(address(u));
        assertEq(c, 1, "not sealed");

        survey.seal(address(u));
        (c,,) = gate.preflight(address(u));
        assertEq(c, 6, "pair missing");

        factory.createL2Wallet(address(u));
        (c,,) = gate.preflight(address(u));
        assertEq(c, 7, "route missing");

        vm.prank(builder);
        ledger.hold(address(sealed_), keccak256("x"), "");
        (c,,) = gate.preflight(address(sealed_));
        assertEq(c, 2, "held");
    }

    function test_preflight_drift_code() public {
        drift = new DriftToken();
        survey.seal(address(drift));
        _wire(address(drift));
        drift.setSymbol("Z");
        (uint8 c,,) = gate.preflight(address(drift));
        assertEq(c, 3);
    }

    function testFuzz_cross_conserves_value(uint96 amt) public {
        amt = uint96(bound(amt, 1, 1_000 ether));
        uint256 total = sealed_.balanceOf(rahul) + sealed_.balanceOf(wallet);
        vm.prank(rahul);
        gate.cross(address(sealed_), amt, rahul);
        assertEq(sealed_.balanceOf(rahul) + sealed_.balanceOf(wallet), total);
        assertEq(sealed_.balanceOf(wallet), amt);
        assertEq(sealed_.balanceOf(address(gate)), 0);
    }
}
