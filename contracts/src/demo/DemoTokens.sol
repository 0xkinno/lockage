// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {DemoBase} from "./DemoBase.sol";

/// Fixed supply (1B), 18 decimals, metadata that can never change. The control case.
contract SealedToken is DemoBase {
    constructor() DemoBase("Lock Sealed", "LSEAL", 1_000_000_000) {}
}

/// Owner can rename the symbol and name. Changing either moves the canonical mirror to a new address.
contract DriftToken is DemoBase {
    address public owner;

    event Renamed(string name, string symbol);

    error NotOwner();

    constructor() DemoBase("Lock Drift", "LDRIFT", 1_000_000_000) {
        owner = msg.sender;
    }

    function setSymbol(string calldata s) external {
        if (msg.sender != owner) revert NotOwner();
        _symbol = s;
        emit Renamed(_name, s);
    }

    function setName(string calldata n) external {
        if (msg.sender != owner) revert NotOwner();
        _name = n;
        emit Renamed(n, _symbol);
    }
}

/// One quadrillion whole tokens at 18 decimals: no feasible weiDecimals exists, it can never graduate.
contract OversizeToken is DemoBase {
    constructor() DemoBase("Lock Oversize", "LBIG", 1_000_000_000_000_000) {}
}

/// 1% of every transfer is burned: amounts do not arrive exactly, so neither the mirror bridge nor a
/// deposit wallet can carry it.
contract TaxToken is DemoBase {
    constructor() DemoBase("Lock Tax", "LTAX", 1_000_000_000) {}

    function _move(address from, address to, uint256 amount) internal override {
        if (from == address(this)) {
            super._move(from, to, amount);
            return;
        }
        uint256 fee = amount / 100;
        super._move(from, to, amount - fee);
        if (fee != 0) {
            if (balanceOf[from] < fee) revert InsufficientBalance();
            _burn(from, fee);
        }
    }
}

/// Owner can mint without limit: supply can outgrow the HyperCore envelope after it was sealed.
contract MintToken is DemoBase {
    address public owner;

    error NotOwner();

    constructor() DemoBase("Lock Mint", "LMINT", 1_000_000_000) {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        _mint(to, amount);
    }
}
