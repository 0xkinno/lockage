// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Minimal safe ERC-20 transfers that tolerate tokens which return nothing.
library SafeTransferLib {
    error TransferFailed();
    error TransferFromFailed();
    error ApproveFailed();

    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory r) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (r.length != 0 && !abi.decode(r, (bool)))) revert TransferFailed();
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory r) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (r.length != 0 && !abi.decode(r, (bool)))) revert TransferFromFailed();
    }

    function safeApprove(address token, address spender, uint256 amount) internal {
        (bool ok, bytes memory r) = token.call(abi.encodeWithSelector(0x095ea7b3, spender, amount));
        if (!ok || (r.length != 0 && !abi.decode(r, (bool)))) revert ApproveFailed();
    }
}
