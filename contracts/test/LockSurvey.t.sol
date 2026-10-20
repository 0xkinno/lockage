// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {LockSurvey} from "../src/LockSurvey.sol";
import {SealedToken, DriftToken, OversizeToken, MintToken} from "../src/demo/DemoTokens.sol";
import {RevertingSymbolToken} from "./mocks/Mocks.sol";

contract LockSurveyTest is Base {
    uint256 constant CAP = (uint256(type(uint64).max) * 9000) / 10000;

    // ----------------------------------------------------------- envelope math

    function test_envelope_1B_18dp_gives_wei8() public view {
        LockSurvey.Envelope memory e = survey.envelope(18, 1_000_000_000 ether);
        assertTrue(e.graduates);
        assertEq(e.bestWei, 8);
        assertEq(e.maxSz, 3);
        assertEq(e.evmExtra, 10);
        assertEq(e.alignUnit, 1e10);
        assertEq(e.coreSupplyWei, 1e17);
    }

    function test_envelope_1T_18dp_gives_wei7() public view {
        LockSurvey.Envelope memory e = survey.envelope(18, 1_000_000_000_000 ether);
        assertTrue(e.graduates);
        assertEq(e.bestWei, 7);
        assertEq(e.maxSz, 2);
    }

    function test_envelope_above_ceiling_never_graduates() public view {
        // 1.66e14 whole tokens at w=5 is the hard ceiling; 2e14 is past it
        LockSurvey.Envelope memory e = survey.envelope(18, 200_000_000_000_000 ether);
        assertFalse(e.graduates);
    }

    function test_envelope_at_ceiling_still_fits() public view {
        LockSurvey.Envelope memory e = survey.envelope(18, 160_000_000_000_000 ether);
        assertTrue(e.graduates);
        assertEq(e.bestWei, 5);
        assertEq(e.maxSz, 0);
    }

    function test_envelope_6dp_usdc_style() public view {
        LockSurvey.Envelope memory e = survey.envelope(6, 1_000_000_000 * 1e6);
        assertTrue(e.graduates);
        assertEq(e.bestWei, 8);
        assertEq(e.evmExtra, -2);
        assertEq(e.alignUnit, 1);
    }

    function test_envelope_8dp_maps_one_to_one() public view {
        LockSurvey.Envelope memory e = survey.envelope(8, 21_000_000 * 1e8);
        assertTrue(e.graduates);
        assertEq(e.bestWei, 8);
        assertEq(e.evmExtra, 0);
        assertEq(e.alignUnit, 1);
    }

    function test_envelope_zero_supply_does_not_graduate() public view {
        assertFalse(survey.envelope(18, 0).graduates);
    }

    function test_envelope_decimals_over_26_cannot_graduate() public view {
        assertFalse(survey.envelope(27, 1e27).graduates);
        assertFalse(survey.envelope(255, 1).graduates);
    }

    function test_envelope_unaligned_supply_falls_to_coarser_wei() public view {
        // 18dp supply of 1 base unit is not a multiple of 1e10 at w=8, nor at any w < 18: no feasible w
        LockSurvey.Envelope memory e = survey.envelope(18, 1);
        assertFalse(e.graduates);
    }

    function test_envelope_alignment_is_monotonic() public view {
        // coarser weiDecimals only demands a larger alignment unit, so a supply that is not a multiple of
        // 1e10 base units at 18 dp has no feasible weiDecimals at all, while 5e11 fits at the finest step.
        LockSurvey.Envelope memory e = survey.envelope(18, 5 * 1e11);
        assertTrue(e.graduates);
        assertEq(e.bestWei, 8);
        assertEq(e.alignUnit, 1e10);
        assertEq(e.coreSupplyWei, 50);
        assertFalse(survey.envelope(18, 5 * 1e11 + 1).graduates);
    }

    function testFuzz_envelope_invariants(uint8 d, uint256 s) public view {
        LockSurvey.Envelope memory e = survey.envelope(d, s);
        if (!e.graduates) return;
        assertGe(e.bestWei, 5);
        assertLe(e.bestWei, 8);
        assertEq(uint256(e.maxSz) + 5, uint256(e.bestWei));
        assertGe(int256(e.evmExtra), -2);
        assertLe(int256(e.evmExtra), 18);
        assertLe(e.coreSupplyWei, CAP);
        assertGt(e.coreSupplyWei, 0);
        if (e.bestWei < d) assertEq(s % e.alignUnit, 0);
    }

    function testFuzz_envelope_no_overflow_any_input(uint8 d, uint256 s) public view {
        survey.envelope(d, s); // must never revert
    }

    function testFuzz_envelope_finest_wins(uint256 sWhole) public view {
        sWhole = bound(sWhole, 1, 1e14);
        LockSurvey.Envelope memory e = survey.envelope(18, sWhole * 1 ether);
        assertTrue(e.graduates);
        // one finer step must not fit
        if (e.bestWei < 8) assertGt(sWhole * 10 ** (uint256(e.bestWei) + 1), CAP);
    }

    // ------------------------------------------------------------------- seal

    function test_seal_records_identity() public {
        SealedToken t = new SealedToken();
        vm.prank(builder);
        (bytes32 mh, address mirror, bool grad) = survey.seal(address(t));
        assertTrue(grad);
        assertEq(mh, survey.metaHash(address(t)));
        assertEq(mirror, factory.expectedL1Mirror(address(t)));
        (, , uint64 at, address by, uint256 supply,) = survey.sealOf(address(t));
        assertGt(at, 0);
        assertEq(by, builder);
        assertEq(supply, 1_000_000_000 ether);
    }

    function test_seal_non_contract_reverts() public {
        vm.expectRevert(LockSurvey.NotAContract.selector);
        survey.seal(address(0xdead));
    }

    function test_seal_reverting_symbol_reverts() public {
        RevertingSymbolToken t = new RevertingSymbolToken();
        vm.expectRevert();
        survey.seal(address(t));
    }

    function test_refresh_same_identity_open_to_anyone() public {
        SealedToken t = new SealedToken();
        vm.prank(builder);
        survey.seal(address(t));
        vm.prank(stranger);
        survey.seal(address(t));
        (,,, address by,,) = survey.sealOf(address(t));
        assertEq(by, builder, "sealer is not replaced by a refresh");
    }

    function test_reseal_after_drift_needs_authority() public {
        DriftToken t = new DriftToken();
        vm.prank(builder);
        survey.seal(address(t));
        t.setSymbol("DRIFT2"); // test contract is the owner
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(LockSurvey.NotSealAuthority.selector, stranger, builder));
        survey.seal(address(t));
    }

    function test_reseal_after_drift_by_sealer() public {
        DriftToken t = new DriftToken();
        vm.prank(builder);
        survey.seal(address(t));
        bytes32 first = survey.metaHash(address(t));
        t.setSymbol("DRIFT2");
        vm.prank(builder);
        survey.seal(address(t));
        (bytes32 mh,,,,,) = survey.sealOf(address(t));
        assertTrue(mh != first);
    }

    function test_reseal_after_drift_by_token_owner() public {
        DriftToken t = new DriftToken();
        vm.prank(builder);
        survey.seal(address(t));
        t.setSymbol("DRIFT2");
        survey.seal(address(t)); // this contract owns the token
        (,,, address by,,) = survey.sealOf(address(t));
        assertEq(by, builder);
    }

    function test_oversize_seals_as_not_graduating() public {
        OversizeToken t = new OversizeToken();
        (, , bool grad) = survey.seal(address(t));
        assertFalse(grad);
    }

    function test_handover() public {
        SealedToken t = new SealedToken();
        vm.prank(builder);
        survey.seal(address(t));
        vm.prank(builder);
        survey.handOver(address(t), rahul);
        (,,, address by,,) = survey.sealOf(address(t));
        assertEq(by, rahul);
        assertTrue(survey.isAuthority(address(t), rahul));
        assertFalse(survey.isAuthority(address(t), builder));
    }

    function test_handover_requires_authority() public {
        SealedToken t = new SealedToken();
        vm.prank(builder);
        survey.seal(address(t));
        vm.prank(stranger);
        vm.expectRevert();
        survey.handOver(address(t), stranger);
    }

    function test_handover_zero_reverts() public {
        SealedToken t = new SealedToken();
        vm.prank(builder);
        survey.seal(address(t));
        vm.prank(builder);
        vm.expectRevert(LockSurvey.ZeroAddress.selector);
        survey.handOver(address(t), address(0));
    }

    function test_unsealed_has_no_authority() public {
        SealedToken t = new SealedToken();
        assertFalse(survey.isAuthority(address(t), builder));
    }

    function test_mint_token_owner_is_authority() public {
        MintToken t = new MintToken();
        vm.prank(builder);
        survey.seal(address(t));
        assertTrue(survey.isAuthority(address(t), address(this)));
    }
}
