// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {LockGate} from "../src/LockGate.sol";
import {UpgradeImplV1, UpgradeImplV2, LockProxy} from "../src/demo/UpgradeToken.sol";
import {IERC20Meta} from "../src/lib/Interfaces.sol";

contract UpgradeTokenTest is Base {
    UpgradeImplV1 token; // the proxy, seen through the V1 ABI
    LockProxy proxy;
    UpgradeImplV2 v2;
    address admin = address(this);

    function setUp() public override {
        super.setUp();
        UpgradeImplV1 v1 = new UpgradeImplV1();
        v2 = new UpgradeImplV2();
        proxy = new LockProxy(address(v1), abi.encodeCall(UpgradeImplV1.initialize, (admin, 1_000_000_000)));
        token = UpgradeImplV1(payable(address(proxy)));
    }

    function test_proxy_reads_like_a_plain_token() public view {
        assertEq(token.symbol(), "LUPG");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000_000 ether);
        assertEq(token.owner(), admin);
    }

    function test_admin_slot_is_readable_from_storage() public view {
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        assertEq(address(uint160(uint256(vm.load(address(proxy), adminSlot)))), admin);
    }

    function test_cannot_initialize_twice() public {
        vm.expectRevert(UpgradeImplV1.AlreadyInitialized.selector);
        token.initialize(stranger, 1);
    }

    function test_only_admin_upgrades() public {
        vm.prank(stranger);
        vm.expectRevert(UpgradeImplV1.NotOwner.selector);
        token.upgradeToAndCall(address(v2), "");
    }

    function test_upgrade_changes_symbol_and_moves_the_mirror() public {
        address before = factory.expectedL1Mirror(address(token));
        token.upgradeToAndCall(address(v2), "");
        assertEq(token.symbol(), "LUPG2");
        assertTrue(factory.expectedL1Mirror(address(token)) != before, "an upgrade moves the canonical mirror");
    }

    function test_lockgate_refuses_after_upgrade() public {
        vm.prank(builder);
        survey.seal(address(token));
        _wire(address(token));
        vm.prank(rahul);
        token.claim();
        vm.prank(rahul);
        token.approve(address(gate), type(uint256).max);
        // before the upgrade the crossing works
        vm.prank(rahul);
        gate.cross(address(token), 10 ether, rahul);

        bytes32 sealedHash = survey.metaHash(address(token));
        token.upgradeToAndCall(address(v2), "");
        bytes32 liveHash = survey.metaHash(address(token));
        assertTrue(sealedHash != liveHash);
        vm.prank(rahul);
        vm.expectRevert(abi.encodeWithSelector(LockGate.MetadataDrift.selector, sealedHash, liveHash));
        gate.cross(address(token), 10 ether, rahul);
    }
}
