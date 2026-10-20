// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Meta {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

interface IOwnable {
    function owner() external view returns (address);
}

/// Elysium ElysiumBridgeFactory (Elysium side). Read surface used by LOCKAGE.
interface IElysiumBridgeFactory {
    function createL2Wallet(address elysiumToken) external returns (address l2Wallet);
    function expectedL1Mirror(address elysiumToken) external view returns (address);
    function predictL2Wallet(address elysiumToken) external view returns (address);
    function l2WalletFor(address elysiumToken) external view returns (address);
}

/// Elysium gateway router (Elysium side). The token argument is the HyperEVM mirror in both directions.
interface IGatewayRouter {
    function getGateway(address token) external view returns (address);

    function outboundTransfer(
        address token,
        address to,
        uint256 amount,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    ) external payable returns (bytes memory);
}
