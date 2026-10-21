// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice A UUPS-style upgradeable demo token, testnet only. Its name and symbol can change through an upgrade, with no
///         setSymbol or setName function anywhere in the interface. That is the rename path a selector scan cannot see.
///         The implementation slot and admin slot follow EIP-1967 so tools can read them from storage.
/// @author 0xkinno
contract UpgradeImplV1 {
    // EIP-1967 slots
    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 internal constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    // token storage (the proxy's storage)
    bool private _initialized;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public claimed;
    uint256 public constant CLAIM_AMOUNT = 1_000 ether;
    uint8 public constant decimals = 18;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Upgraded(address indexed implementation);

    error AlreadyInitialized();
    error NotOwner();
    error AlreadyClaimed();
    error InsufficientBalance();
    error InsufficientAllowance();

    /// Called once through the proxy constructor. Mints the supply to the proxy itself, the claim reservoir.
    function initialize(address owner_, uint256 supplyWhole) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;
        _setAdmin(owner_);
        totalSupply = supplyWhole * 1 ether;
        balanceOf[address(this)] = totalSupply;
        emit Transfer(address(0), address(this), totalSupply);
    }

    function name() public view virtual returns (string memory) {
        return "Lock Upgrade";
    }

    function symbol() public view virtual returns (string memory) {
        return "LUPG";
    }

    function owner() public view returns (address a) {
        bytes32 s = ADMIN_SLOT;
        assembly {
            a := sload(s)
        }
    }

    function implementation() external view returns (address a) {
        bytes32 s = IMPL_SLOT;
        assembly {
            a := sload(s)
        }
    }

    /// UUPS: the logic contract carries the upgrade function.
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable {
        if (msg.sender != owner()) revert NotOwner();
        bytes32 s = IMPL_SLOT;
        assembly {
            sstore(s, newImplementation)
        }
        emit Upgraded(newImplementation);
        if (data.length != 0) {
            (bool ok, bytes memory ret) = newImplementation.delegatecall(data);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }

    function claim() external {
        if (claimed[msg.sender]) revert AlreadyClaimed();
        claimed[msg.sender] = true;
        _move(address(this), msg.sender, CLAIM_AMOUNT);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = a - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] -= amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _setAdmin(address a) internal {
        bytes32 s = ADMIN_SLOT;
        assembly {
            sstore(s, a)
        }
    }
}

/// The new implementation: same storage, a different symbol. Upgrading to it moves the canonical mirror.
contract UpgradeImplV2 is UpgradeImplV1 {
    function name() public pure override returns (string memory) {
        return "Lock Upgrade v2";
    }

    function symbol() public pure override returns (string memory) {
        return "LUPG2";
    }
}

/// Minimal EIP-1967 proxy. The constructor sets the implementation and runs the initializer through delegatecall.
contract LockProxy {
    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address impl, bytes memory initData) {
        bytes32 s = IMPL_SLOT;
        assembly {
            sstore(s, impl)
        }
        (bool ok,) = impl.delegatecall(initData);
        require(ok, "init failed");
    }

    fallback() external payable {
        bytes32 s = IMPL_SLOT;
        assembly {
            let impl := sload(s)
            calldatacopy(0, 0, calldatasize())
            let r := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch r
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
