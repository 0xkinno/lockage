import { defineChain } from "viem";

export const ELYSIUM_RPC = process.env.NEXT_PUBLIC_ELYSIUM_RPC ?? "https://testnet-rpc.elysium.kinetiq.xyz";
export const HYPEREVM_RPC = process.env.NEXT_PUBLIC_HYPEREVM_RPC ?? "https://rpc.hyperliquid-testnet.xyz/evm";

export const elysiumTestnet = defineChain({
  id: 99801,
  name: "Elysium Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [ELYSIUM_RPC] } },
  blockExplorers: { default: { name: "Elysium Explorer", url: "https://elysium.kinetiq.xyz/testnet-explorer" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const hyperEvmTestnet = defineChain({
  id: 998,
  name: "HyperEVM Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [HYPEREVM_RPC] } },
  blockExplorers: { default: { name: "HyperEVM Explorer", url: "https://testnet.hyperevm-explorer.xyz" } },
  testnet: true,
});

/** Published Elysium and HyperEVM testnet addresses. Re-checked against /docs/bridge-contracts (see docs/EVIDENCE.md). */
export const ADDR = {
  elysium: {
    bridgeFactory: "0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a",
    router: "0x89659883a9d980925733B0A698F117AAb65ac718",
    walletGateway: "0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959",
    erc20Gateway: "0x30545d8b24185DdFe83E75aB6939f867b664e2E1",
    arbSys: "0x0000000000000000000000000000000000000064",
    arbRetryableTx: "0x000000000000000000000000000000000000006E",
  },
  hyperevm: {
    mirrorFactory: "0xcaDb9986F3727177d48FA07294E1730f9D19290b",
    router: "0x1aAE2caD8B0249905492087EF230FcCEa3707C45",
    mirrorGateway: "0x08922Faa84aC2a54aa3cFD3725b03ca256F52Da2",
    outbox: "0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060",
    bridge: "0x36dAbc3CEE2E1084B7d04c8015Ef68Cac78f4f37",
    rollup: "0xEbf08e34941fd93a0Fc1cD89dbBF7447267039Df",
  },
} as const;

export const EXPLORER = {
  elysium: "https://elysium.kinetiq.xyz/testnet-explorer",
  hyperevm: "https://testnet.hyperevm-explorer.xyz",
} as const;

export const txUrl = (chain: "elysium" | "hyperevm", hash: string) => `${EXPLORER[chain]}/tx/${hash}`;
export const addrUrl = (chain: "elysium" | "hyperevm", a: string) => `${EXPLORER[chain]}/address/${a}`;

export const FAUCETS = {
  elysium: "https://elysium.kinetiq.xyz/testnet-faucet",
  hyperliquid: "https://app.hyperliquid-testnet.xyz/drip",
} as const;
