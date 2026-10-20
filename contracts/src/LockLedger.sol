// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LockSurvey} from "./LockSurvey.sol";

/// @title LockLedger
/// @notice The builder's decisions about a lockkeeper finding, signed by the builder's own wallet and
///         bound to the hash of the finding that was on screen. A changed finding refuses the old decision.
///         A hold is the builder's emergency brake: LockGate refuses crossings while a token is held.
/// @author 0xkinno
contract LockLedger {
    enum Kind { None, Acknowledged, Held }

    struct Decision {
        Kind kind;
        bytes32 findingHash;
        address by;
        uint64 at;
        string note;
    }

    LockSurvey public immutable survey;
    mapping(address token => Decision) internal _decisions;

    event Acknowledged(address indexed token, address indexed by, bytes32 findingHash);
    event Held(address indexed token, address indexed by, bytes32 findingHash, string note);

    error NotAuthority(address caller);
    error EmptyFinding();
    error NoteTooLong();

    constructor(LockSurvey s) {
        survey = s;
    }

    function acknowledge(address token, bytes32 findingHash) external {
        _check(token, findingHash);
        _decisions[token] = Decision(Kind.Acknowledged, findingHash, msg.sender, uint64(block.timestamp), "");
        emit Acknowledged(token, msg.sender, findingHash);
    }

    function hold(address token, bytes32 findingHash, string calldata note) external {
        _check(token, findingHash);
        if (bytes(note).length > 280) revert NoteTooLong();
        _decisions[token] = Decision(Kind.Held, findingHash, msg.sender, uint64(block.timestamp), note);
        emit Held(token, msg.sender, findingHash, note);
    }

    function decisionOf(address token) external view returns (Decision memory) {
        return _decisions[token];
    }

    /// True when the recorded decision answers exactly the finding now on screen.
    function isCurrent(address token, bytes32 findingHash) external view returns (bool) {
        Decision storage d = _decisions[token];
        return d.kind != Kind.None && d.findingHash == findingHash;
    }

    function isHeld(address token) external view returns (bool) {
        return _decisions[token].kind == Kind.Held;
    }

    function _check(address token, bytes32 findingHash) internal view {
        if (findingHash == bytes32(0)) revert EmptyFinding();
        if (!survey.isAuthority(token, msg.sender)) revert NotAuthority(msg.sender);
    }
}
