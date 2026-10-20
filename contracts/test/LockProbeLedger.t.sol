// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {LockProbe} from "../src/LockProbe.sol";
import {LockLedger} from "../src/LockLedger.sol";
import {SealedToken, TaxToken, DriftToken} from "../src/demo/DemoTokens.sol";
import {ReentrantToken, NoReturnToken} from "./mocks/Mocks.sol";

contract LockProbeTest is Base {
    function test_probe_exact_token() public {
        SealedToken t = new SealedToken();
        vm.startPrank(rahul);
        t.claim();
        t.approve(address(probe), 100 ether);
        (uint256 rec, uint256 ret, bool exact) = probe.probe(address(t), 100 ether);
        vm.stopPrank();
        assertTrue(exact);
        assertEq(rec, 100 ether);
        assertEq(ret, 100 ether);
        assertEq(t.balanceOf(address(probe)), 0);
        assertEq(t.balanceOf(rahul), 1_000 ether);
    }

    function test_probe_tax_token_flags_inexact_and_keeps_nothing() public {
        TaxToken t = new TaxToken();
        vm.startPrank(rahul);
        t.claim();
        t.approve(address(probe), 100 ether);
        (uint256 rec, uint256 ret, bool exact) = probe.probe(address(t), 100 ether);
        vm.stopPrank();
        assertFalse(exact);
        assertEq(rec, 99 ether);
        assertLt(ret, rec, "return leg is taxed too");
        assertEq(t.balanceOf(address(probe)), 0, "probe holds nothing after a taxed path");
    }

    function test_probe_zero_amount_reverts() public {
        SealedToken t = new SealedToken();
        vm.expectRevert(LockProbe.ZeroAmount.selector);
        probe.probe(address(t), 0);
    }

    function test_probe_without_allowance_reverts() public {
        SealedToken t = new SealedToken();
        vm.prank(rahul);
        t.claim();
        vm.prank(rahul);
        vm.expectRevert();
        probe.probe(address(t), 1 ether);
    }

    function test_probe_no_return_token() public {
        NoReturnToken n = new NoReturnToken();
        n.mintTo(rahul, 10 ether);
        vm.startPrank(rahul);
        n.approve(address(probe), 10 ether);
        (,, bool exact) = probe.probe(address(n), 10 ether);
        vm.stopPrank();
        assertTrue(exact);
        assertEq(n.balanceOf(address(probe)), 0);
    }

    function test_probe_reentrancy_blocked() public {
        ReentrantToken r = new ReentrantToken();
        r.mintTo(rahul, 10 ether);
        vm.prank(rahul);
        r.approve(address(probe), 10 ether);
        r.arm(address(probe), abi.encodeCall(LockProbe.probe, (address(r), 1 ether)));
        vm.prank(rahul);
        probe.probe(address(r), 2 ether);
        assertFalse(r.reentrySucceeded());
        assertEq(r.balanceOf(address(probe)), 0);
    }

    function testFuzz_probe_never_keeps_funds(uint96 amt) public {
        amt = uint96(bound(amt, 1, 1_000 ether));
        TaxToken t = new TaxToken();
        vm.startPrank(rahul);
        t.claim();
        t.approve(address(probe), amt);
        probe.probe(address(t), amt);
        vm.stopPrank();
        assertEq(t.balanceOf(address(probe)), 0);
    }
}

contract LockLedgerTest is Base {
    SealedToken t;
    bytes32 f = keccak256("finding-1");

    function setUp() public override {
        super.setUp();
        t = new SealedToken();
        vm.prank(builder);
        survey.seal(address(t));
    }

    function test_acknowledge_records_decision() public {
        vm.prank(builder);
        ledger.acknowledge(address(t), f);
        LockLedger.Decision memory d = ledger.decisionOf(address(t));
        assertEq(uint8(d.kind), uint8(LockLedger.Kind.Acknowledged));
        assertEq(d.findingHash, f);
        assertEq(d.by, builder);
        assertFalse(ledger.isHeld(address(t)));
    }

    function test_hold_records_note_and_holds() public {
        vm.prank(builder);
        ledger.hold(address(t), f, "escrow short by 3");
        LockLedger.Decision memory d = ledger.decisionOf(address(t));
        assertEq(uint8(d.kind), uint8(LockLedger.Kind.Held));
        assertEq(d.note, "escrow short by 3");
        assertTrue(ledger.isHeld(address(t)));
    }

    function test_stranger_cannot_decide() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LockLedger.NotAuthority.selector, stranger));
        ledger.acknowledge(address(t), f);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LockLedger.NotAuthority.selector, stranger));
        ledger.hold(address(t), f, "");
    }

    function test_decision_bound_to_finding_hash() public {
        vm.prank(builder);
        ledger.acknowledge(address(t), f);
        assertTrue(ledger.isCurrent(address(t), f));
        assertFalse(ledger.isCurrent(address(t), keccak256("finding-2")), "a changed finding refuses the old decision");
    }

    function test_empty_finding_reverts() public {
        vm.prank(builder);
        vm.expectRevert(LockLedger.EmptyFinding.selector);
        ledger.acknowledge(address(t), bytes32(0));
    }

    function test_note_too_long_reverts() public {
        bytes memory long = new bytes(281);
        for (uint256 i; i < 281; i++) long[i] = "a";
        vm.prank(builder);
        vm.expectRevert(LockLedger.NoteTooLong.selector);
        ledger.hold(address(t), f, string(long));
    }

    function test_unsealed_token_has_no_authority() public {
        SealedToken u = new SealedToken();
        vm.prank(builder);
        vm.expectRevert(abi.encodeWithSelector(LockLedger.NotAuthority.selector, builder));
        ledger.acknowledge(address(u), f);
    }

    function test_token_owner_may_decide() public {
        DriftToken d = new DriftToken();
        vm.prank(builder);
        survey.seal(address(d));
        ledger.acknowledge(address(d), f); // this contract owns the token
        assertEq(ledger.decisionOf(address(d)).by, address(this));
    }

    function test_ack_replaces_hold() public {
        vm.startPrank(builder);
        ledger.hold(address(t), f, "x");
        ledger.acknowledge(address(t), f);
        vm.stopPrank();
        assertFalse(ledger.isHeld(address(t)));
    }

    function test_no_decision_by_default() public view {
        assertEq(uint8(ledger.decisionOf(address(t)).kind), uint8(LockLedger.Kind.None));
        assertFalse(ledger.isCurrent(address(t), f));
    }
}

contract DemoTokensTest is Base {
    function test_claim_once() public {
        SealedToken t = new SealedToken();
        vm.prank(rahul);
        t.claim();
        assertEq(t.balanceOf(rahul), 1_000 ether);
        vm.prank(rahul);
        vm.expectRevert();
        t.claim();
    }

    function test_drift_only_owner_renames() public {
        DriftToken d = new DriftToken();
        vm.prank(stranger);
        vm.expectRevert();
        d.setSymbol("X");
        d.setSymbol("Y");
        assertEq(d.symbol(), "Y");
    }

    function test_supply_values() public {
        assertEq(new SealedToken().totalSupply(), 1_000_000_000 ether);
    }
}
