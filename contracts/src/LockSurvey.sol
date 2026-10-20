// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Meta, IOwnable, IElysiumBridgeFactory} from "./lib/Interfaces.sol";

/// @title LockSurvey
/// @notice Reads a token the way HyperCore will hold it, computes the graduation envelope, and seals
///         the token's bridge identity (metadata hash + canonical mirror) so a later crossing can be
///         refused if the route drifted. Mirrors src/lib/envelope.ts exactly (tested for equality).
/// @author 0xkinno
contract LockSurvey {
    /// HyperCore Core-wei ceiling: balances and supply are uint64.
    uint256 internal constant CORE_MAX = type(uint64).max;
    /// Never plan at the overflow edge.
    uint256 internal constant HEADROOM_BPS = 9_000;
    /// szDecimals >= 0 and szDecimals + 5 <= weiDecimals.
    uint256 internal constant MIN_WEI = 5;
    /// Planning cap for weiDecimals. 843 of 1673 live HyperCore testnet tokens sit at 8;
    /// the few above it are older tokens listed as exceptions in docs/DISCOVERY.md.
    uint256 internal constant MAX_WEI = 8;
    /// evmExtraWeiDecimals (underlying decimals minus weiDecimals) must lie in [-2, 18].
    uint256 internal constant MAX_EXTRA_NEG = 2;
    uint256 internal constant MAX_EXTRA_POS = 18;

    IElysiumBridgeFactory public immutable bridgeFactory;

    struct Envelope {
        bool graduates;
        uint8 bestWei;
        uint8 maxSz;
        int8 evmExtra;
        uint256 alignUnit;
        uint256 coreSupplyWei;
    }

    struct Seal {
        bytes32 metaHash;
        address mirror;
        uint64 sealedAt;
        address sealedBy;
        uint256 supplyAtSeal;
        Envelope env;
    }

    mapping(address token => Seal) internal _seals;

    event Sealed(address indexed token, address indexed by, bytes32 metaHash, address mirror, uint8 bestWei, bool graduates);
    event SealHandedOver(address indexed token, address indexed from, address indexed to);

    error NotAContract();
    error NotSealAuthority(address caller, address sealer);
    error ZeroAddress();

    constructor(IElysiumBridgeFactory f) {
        bridgeFactory = f;
    }

    // ------------------------------------------------------------------ views

    function metaHash(address token) public view returns (bytes32) {
        IERC20Meta t = IERC20Meta(token);
        return keccak256(abi.encode(t.name(), t.symbol(), t.decimals()));
    }

    /// Pure HyperCore graduation envelope, finest granularity first.
    function envelope(uint8 d, uint256 supplyBase) public pure returns (Envelope memory e) {
        if (supplyBase == 0) return e;
        uint256 hi = uint256(d) + MAX_EXTRA_NEG;
        if (hi > MAX_WEI) hi = MAX_WEI;
        uint256 lo = d > MAX_EXTRA_POS ? uint256(d) - MAX_EXTRA_POS : 0;
        if (lo < MIN_WEI) lo = MIN_WEI;
        if (lo > hi) return e;
        for (uint256 w = hi; w >= lo; w--) {
            (bool ok, uint256 core, uint256 unit) = _fit(d, supplyBase, w);
            if (ok) {
                e.graduates = true;
                e.bestWei = uint8(w);
                e.maxSz = uint8(w - MIN_WEI);
                e.evmExtra = int8(int256(uint256(d)) - int256(w));
                e.alignUnit = unit;
                e.coreSupplyWei = core;
                return e;
            }
            if (w == lo) break;
        }
    }

    function _fit(uint8 d, uint256 s, uint256 w) internal pure returns (bool, uint256, uint256) {
        uint256 cap = (CORE_MAX * HEADROOM_BPS) / 10_000;
        uint256 unit = 1;
        uint256 core;
        if (w >= d) {
            uint256 mult = 10 ** (w - d);
            if (s > cap / mult) return (false, 0, unit);
            core = s * mult;
        } else {
            unit = 10 ** (d - w);
            if (s % unit != 0) return (false, 0, unit);
            core = s / unit;
        }
        if (core > cap) return (false, core, unit);
        return (true, core, unit);
    }

    function survey(address token) public view returns (Envelope memory e, bytes32 mh, address mirror) {
        if (token.code.length == 0) revert NotAContract();
        IERC20Meta t = IERC20Meta(token);
        e = envelope(t.decimals(), t.totalSupply());
        mh = metaHash(token);
        mirror = bridgeFactory.expectedL1Mirror(token);
    }

    function sealOf(address token)
        external
        view
        returns (bytes32 mh, address mirror, uint64 sealedAt, address sealedBy, uint256 supplyAtSeal, bool graduates)
    {
        Seal storage s = _seals[token];
        return (s.metaHash, s.mirror, s.sealedAt, s.sealedBy, s.supplyAtSeal, s.env.graduates);
    }

    function sealEnvelope(address token) external view returns (Envelope memory) {
        return _seals[token].env;
    }

    /// True for the original sealer or the token's own owner().
    function isAuthority(address token, address who) public view returns (bool) {
        Seal storage s = _seals[token];
        if (s.sealedAt == 0) return false;
        if (who == s.sealedBy) return true;
        try IOwnable(token).owner() returns (address o) {
            return o != address(0) && o == who;
        } catch {
            return false;
        }
    }

    // ----------------------------------------------------------------- writes

    /// Anyone may make the first seal. Re-sealing a changed identity needs the sealer or the token owner,
    /// so a stranger cannot re-pin a route the builder has not reviewed. A refresh of an unchanged
    /// identity is open to anyone (it only updates supply and envelope).
    function seal(address token) external returns (bytes32 mh, address mirror, bool graduates) {
        (Envelope memory e, bytes32 h, address m) = survey(token);
        Seal storage s = _seals[token];
        if (s.sealedAt != 0 && (s.metaHash != h || s.mirror != m) && !isAuthority(token, msg.sender)) {
            revert NotSealAuthority(msg.sender, s.sealedBy);
        }
        address by = s.sealedAt == 0 ? msg.sender : s.sealedBy;
        s.metaHash = h;
        s.mirror = m;
        s.sealedAt = uint64(block.timestamp);
        s.sealedBy = by;
        s.supplyAtSeal = IERC20Meta(token).totalSupply();
        s.env = e;
        emit Sealed(token, msg.sender, h, m, e.bestWei, e.graduates);
        return (h, m, e.graduates);
    }

    /// Lets the sealer pass authority (for example to the builder's multisig).
    function handOver(address token, address to) external {
        if (to == address(0)) revert ZeroAddress();
        Seal storage s = _seals[token];
        if (!isAuthority(token, msg.sender)) revert NotSealAuthority(msg.sender, s.sealedBy);
        emit SealHandedOver(token, s.sealedBy, to);
        s.sealedBy = to;
    }
}
