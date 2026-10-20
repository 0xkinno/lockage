// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Meta, IElysiumBridgeFactory, IGatewayRouter} from "./lib/Interfaces.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";
import {LockSurvey} from "./LockSurvey.sol";
import {LockLedger} from "./LockLedger.sol";

/// @title LockGate
/// @notice The enforcement point for crossings. A crossing through LockGate either lands on the mirror the
///         token was sealed with, through a registered route, with exact escrow, or it reverts.
/// @author 0xkinno
contract LockGate {
    using SafeTransferLib for address;

    LockSurvey public immutable survey;
    LockLedger public immutable ledger;
    IElysiumBridgeFactory public immutable factory;
    IGatewayRouter public immutable router;
    /// Bridge-wallet gateway: the only gateway a sealed token may cross through.
    address public immutable walletGateway;

    event Crossed(address indexed token, address indexed from, address indexed to, uint256 amount, address mirror);

    error NotSealed();
    error OnHold();
    error ZeroRecipient();
    error ZeroAmount();
    error MetadataDrift(bytes32 sealed_, bytes32 live);
    error MirrorIdentityDrift(address sealed_, address live);
    error EnvelopeBroken();
    error PairNotDeployed();
    error RouteNotRegistered(address gateway);
    error EscrowShortfall(uint256 expected, uint256 got);
    error Reentered();

    uint256 private _lock = 1;

    modifier nonReentrant() {
        if (_lock != 1) revert Reentered();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(LockSurvey s, LockLedger l, IGatewayRouter r, address gateway) {
        survey = s;
        ledger = l;
        factory = s.bridgeFactory();
        router = r;
        walletGateway = gateway;
    }

    /// Pre-flight as a view for the UI. code 0 = pass, otherwise the first failing check:
    /// 1 not sealed, 2 on hold, 3 metadata drift, 4 mirror drift, 5 envelope broken, 6 pair missing, 7 route missing.
    function preflight(address token) public view returns (uint8 code, address mirror, address wallet) {
        (bytes32 mh, address sealedMirror, uint64 at,,, bool sealedGrad) = survey.sealOf(token);
        if (at == 0) return (1, address(0), address(0));
        if (ledger.isHeld(token)) return (2, sealedMirror, address(0));
        if (survey.metaHash(token) != mh) return (3, sealedMirror, address(0));
        mirror = factory.expectedL1Mirror(token);
        if (mirror != sealedMirror) return (4, mirror, address(0));
        if (sealedGrad && !_graduates(token)) return (5, mirror, address(0));
        wallet = factory.l2WalletFor(token);
        if (wallet == address(0)) return (6, mirror, address(0));
        if (router.getGateway(mirror) != walletGateway) return (7, mirror, wallet);
        return (0, mirror, wallet);
    }

    function cross(address token, uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroRecipient();
        if (amount == 0) revert ZeroAmount();
        (address mirror, address wallet) = _validate(token);

        IERC20Meta t = IERC20Meta(token);
        uint256 walletBefore = t.balanceOf(wallet);
        uint256 selfBefore = t.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 pulled = t.balanceOf(address(this)) - selfBefore;
        if (pulled != amount) revert EscrowShortfall(amount, pulled);
        token.safeApprove(wallet, amount);
        router.outboundTransfer(mirror, to, amount, 0, 0, "");
        token.safeApprove(wallet, 0);
        uint256 got = t.balanceOf(wallet) - walletBefore;
        if (got != amount) revert EscrowShortfall(amount, got);
        emit Crossed(token, msg.sender, to, amount, mirror);
    }

    /// The same checks as preflight, as reverts with data.
    function _validate(address token) internal view returns (address mirror, address wallet) {
        (bytes32 mh, address sealedMirror, uint64 at,,, bool sealedGrad) = survey.sealOf(token);
        if (at == 0) revert NotSealed();
        if (ledger.isHeld(token)) revert OnHold();
        bytes32 live = survey.metaHash(token);
        if (live != mh) revert MetadataDrift(mh, live);
        mirror = factory.expectedL1Mirror(token);
        if (mirror != sealedMirror) revert MirrorIdentityDrift(sealedMirror, mirror);
        if (sealedGrad && !_graduates(token)) revert EnvelopeBroken();
        wallet = factory.l2WalletFor(token);
        if (wallet == address(0)) revert PairNotDeployed();
        address gw = router.getGateway(mirror);
        if (gw != walletGateway) revert RouteNotRegistered(gw);
    }

    function _graduates(address token) internal view returns (bool) {
        IERC20Meta t = IERC20Meta(token);
        return survey.envelope(t.decimals(), t.totalSupply()).graduates;
    }
}
