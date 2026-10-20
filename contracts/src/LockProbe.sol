// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Meta} from "./lib/Interfaces.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";

/// @title LockProbe
/// @notice Measures whether a token delivers exactly what is sent (no transfer tax, no rebase on move).
///         Pulls `amount` from the caller, measures the delta, sends back what arrived, and never keeps funds.
/// @author 0xkinno
contract LockProbe {
    using SafeTransferLib for address;

    event Probed(address indexed token, address indexed user, uint256 sent, uint256 received, uint256 returned);

    error ZeroAmount();
    error Reentered();

    uint256 private _lock = 1;

    modifier nonReentrant() {
        if (_lock != 1) revert Reentered();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @return received what the probe actually received
    /// @return returned what the user actually got back
    /// @return exact true when received == amount and returned == received
    function probe(address token, uint256 amount)
        external
        nonReentrant
        returns (uint256 received, uint256 returned, bool exact)
    {
        if (amount == 0) revert ZeroAmount();
        IERC20Meta t = IERC20Meta(token);
        uint256 beforeSelf = t.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        received = t.balanceOf(address(this)) - beforeSelf;

        uint256 beforeUser = t.balanceOf(msg.sender);
        if (received != 0) token.safeTransfer(msg.sender, received);
        returned = t.balanceOf(msg.sender) - beforeUser;

        exact = received == amount && returned == received;
        emit Probed(token, msg.sender, amount, received, returned);
    }
}
