// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Meta, IElysiumBridgeFactory, IGatewayRouter} from "../../src/lib/Interfaces.sol";

interface IERC20Min {
    function transferFrom(address, address, uint256) external returns (bool);
}

/// Escrow wallet stand-in: the gateway tells it to pull `amount` from `from`.
contract MockWallet {
    address public immutable token;
    address public immutable gateway;
    /// when set, the wallet pulls one unit less than asked (a lying escrow) to exercise EscrowShortfall
    bool public shortChange;

    constructor(address t, address g) {
        token = t;
        gateway = g;
    }

    function setShortChange(bool v) external {
        shortChange = v;
    }

    function lock(address from, uint256 amount) external {
        require(msg.sender == gateway, "gateway only");
        (bool ok,) = token.call(abi.encodeWithSelector(0x23b872dd, from, address(this), shortChange ? amount - 1 : amount));
        require(ok, "pull failed");
    }
}

contract MockBridgeFactory is IElysiumBridgeFactory {
    address public gateway;
    mapping(address => address) public wallets;

    function setGateway(address g) external {
        gateway = g;
    }

    function expectedL1Mirror(address token) public view returns (address) {
        IERC20Meta t = IERC20Meta(token);
        return address(uint160(uint256(keccak256(abi.encode(token, t.name(), t.symbol(), t.decimals())))));
    }

    function createL2Wallet(address token) external returns (address w) {
        w = address(new MockWallet(token, gateway));
        wallets[token] = w;
    }

    function predictL2Wallet(address token) external view returns (address) {
        return wallets[token];
    }

    function l2WalletFor(address token) external view returns (address) {
        return wallets[token];
    }
}

contract MockWalletGateway {
    MockBridgeFactory public factory;
    mapping(address mirror => address token) public tokenOfMirror;

    event Outbound(address indexed mirror, address indexed from, address indexed to, uint256 amount);

    constructor(MockBridgeFactory f) {
        factory = f;
    }

    function register(address token) external {
        tokenOfMirror[factory.expectedL1Mirror(token)] = token;
    }

    function outbound(address from, address mirror, address to, uint256 amount) external {
        address token = tokenOfMirror[mirror];
        MockWallet(factory.l2WalletFor(token)).lock(from, amount);
        emit Outbound(mirror, from, to, amount);
    }
}

contract MockRouter is IGatewayRouter {
    mapping(address mirror => address gw) public gateways;

    function setGateway(address mirror, address gw) external {
        gateways[mirror] = gw;
    }

    function getGateway(address mirror) external view returns (address) {
        return gateways[mirror];
    }

    function outboundTransfer(address mirror, address to, uint256 amount, uint256, uint256, bytes calldata)
        external
        payable
        returns (bytes memory)
    {
        MockWalletGateway(gateways[mirror]).outbound(msg.sender, mirror, to, amount);
        return "";
    }
}

/// A token whose decimals() can be flipped between calls: the gate must read live values every time.
contract LiarToken {
    uint8 public decimals = 18;
    uint256 public totalSupply = 1_000_000_000 ether;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function name() external pure returns (string memory) {
        return "Liar";
    }

    function symbol() external pure returns (string memory) {
        return "LIAR";
    }

    function flip() external {
        decimals = decimals == 18 ? 6 : 18;
    }

    function mintTo(address a, uint256 v) external {
        balanceOf[a] += v;
    }
}

/// Token whose symbol() reverts.
contract RevertingSymbolToken {
    function name() external pure returns (string memory) {
        return "R";
    }

    function symbol() external pure returns (string memory) {
        revert("no symbol");
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function totalSupply() external pure returns (uint256) {
        return 1e27;
    }
}

/// Token that re-enters the caller of transferFrom (the gate or the probe) once.
contract ReentrantToken {
    string public name = "Re";
    string public symbol = "RE";
    uint8 public decimals = 18;
    uint256 public totalSupply = 1e27;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public target;
    bytes public payload;
    bool public armed;
    bool public reentrySucceeded;

    function arm(address t, bytes calldata p) external {
        target = t;
        payload = p;
        armed = true;
    }

    function mintTo(address a, uint256 v) external {
        balanceOf[a] += v;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }

    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        if (armed) {
            armed = false;
            (bool ok,) = target.call(payload);
            reentrySucceeded = ok;
        }
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[to] += v;
        return true;
    }
}

/// Token with no return value on transfer functions (like some legacy tokens).
contract NoReturnToken {
    string public name = "NR";
    string public symbol = "NR";
    uint8 public decimals = 18;
    uint256 public totalSupply = 1e27;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mintTo(address a, uint256 v) external {
        balanceOf[a] += v;
    }

    function approve(address s, uint256 v) external {
        allowance[msg.sender][s] = v;
    }

    function transfer(address to, uint256 v) external {
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
    }

    function transferFrom(address f, address to, uint256 v) external {
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[to] += v;
    }
}
