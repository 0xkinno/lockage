import { createPublicClient, http, fallback } from "viem";
import { elysiumTestnet, hyperEvmTestnet } from "./chains";

export const elyClient = createPublicClient({
  chain: elysiumTestnet,
  transport: fallback([http(elysiumTestnet.rpcUrls.default.http[0], { retryCount: 2, timeout: 15_000, batch: true })]),
  batch: { multicall: true },
});

export const heClient = createPublicClient({
  chain: hyperEvmTestnet,
  transport: fallback([http(hyperEvmTestnet.rpcUrls.default.http[0], { retryCount: 2, timeout: 15_000, batch: true })]),
  batch: { multicall: true },
});
