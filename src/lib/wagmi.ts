import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { elysiumTestnet, hyperEvmTestnet } from "./chains";

/**
 * No WalletConnect project id is needed. Wallets are discovered through EIP-6963 (MetaMask, Rabby, OKX,
 * Coinbase Wallet and any other injected wallet announce themselves); a plain injected connector is the
 * fallback for wallets that only set window.ethereum.
 */
export const wagmiConfig = createConfig({
  chains: [elysiumTestnet, hyperEvmTestnet],
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  transports: {
    [elysiumTestnet.id]: http(elysiumTestnet.rpcUrls.default.http[0]),
    [hyperEvmTestnet.id]: http(hyperEvmTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
