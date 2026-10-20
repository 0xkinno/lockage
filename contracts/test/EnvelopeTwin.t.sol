// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {LockSurvey} from "../src/LockSurvey.sol";

/// Feeds the same 10,000 vectors produced by src/lib/envelope.ts to the Solidity implementation.
contract EnvelopeTwinTest is Base {
    function test_twin_equality_10000_vectors() public view {
        string memory json = vm.readFile("data/envelope-vectors.json");
        uint256 n = vm.parseJsonUint(json, ".count");
        assertEq(n, 10000);
        uint256[] memory ds = vm.parseJsonUintArray(json, ".d");
        uint256[] memory sup = vm.parseJsonUintArray(json, ".supply");
        uint256[] memory bw = vm.parseJsonUintArray(json, ".bestWei");
        uint256[] memory au = vm.parseJsonUintArray(json, ".alignUnit");
        uint256[] memory cs = vm.parseJsonUintArray(json, ".coreSupplyWei");
        bool[] memory gr = vm.parseJsonBoolArray(json, ".graduates");
        assertEq(ds.length, n);
        for (uint256 i; i < n; i++) {
            LockSurvey.Envelope memory e = survey.envelope(uint8(ds[i]), sup[i]);
            assertEq(e.graduates, gr[i], "graduates");
            assertEq(uint256(e.bestWei), bw[i], "bestWei");
            assertEq(e.alignUnit, au[i], "alignUnit");
            assertEq(e.coreSupplyWei, cs[i], "coreSupplyWei");
            if (e.graduates) assertEq(int256(e.evmExtra), int256(ds[i]) - int256(bw[i]), "evmExtra");
        }
    }
}
