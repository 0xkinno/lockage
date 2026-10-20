import { createPublicClient, createWalletClient, http, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Page } from "@playwright/test";
import { elysiumTestnet, hyperEvmTestnet } from "../../src/lib/chains";

/**
 * A real EIP-1193 wallet for tests. It announces itself over EIP-6963 exactly like MetaMask or Rabby, holds a
 * local private key, handles chain switching, and signs and broadcasts real transactions to the real RPC.
 * Nothing about the app is mocked: only the browser extension is replaced.
 */
export async function installWallet(page: Page, pk: Hex, opts: { startChain?: number; name?: string } = {}) {
  const account = privateKeyToAccount(pk);
  const chains = { [elysiumTestnet.id]: elysiumTestnet, [hyperEvmTestnet.id]: hyperEvmTestnet } as const;
  let chainId: number = opts.startChain ?? elysiumTestnet.id;
  // like a real wallet: no accounts are exposed until the user approves a connection
  let authorized = false;
  const log: { method: string; params?: unknown }[] = [];
  const hashes: Hex[] = [];

  const pub = (id: number) => createPublicClient({ chain: chains[id as 99801 | 998], transport: http() });
  const wal = (id: number) => createWalletClient({ account, chain: chains[id as 99801 | 998], transport: http() });

  await page.exposeFunction("__walletRequest", async (req: { method: string; params?: unknown[] }) => {
    log.push({ method: req.method, params: req.params });
    const p = (req.params ?? []) as Record<string, unknown>[];
    switch (req.method) {
      case "eth_requestAccounts":
        authorized = true;
        return [account.address];
      case "eth_accounts":
        return authorized ? [account.address] : [];
      case "eth_chainId":
        return toHex(chainId);
      case "net_version":
        return String(chainId);
      case "wallet_switchEthereumChain": {
        const id = parseInt(String((p[0] as { chainId: string }).chainId), 16);
        if (!chains[id as 99801 | 998]) throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
        chainId = id;
        return null;
      }
      case "wallet_addEthereumChain":
        return null;
      case "eth_sendTransaction": {
        const tx = p[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
        const hash = await wal(chainId).sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
        hashes.push(hash);
        return hash;
      }
      case "personal_sign":
        return account.signMessage({ message: { raw: (req.params as Hex[])[0] } });
      default:
        return pub(chainId).request({ method: req.method as never, params: req.params as never });
    }
  });

  await page.addInitScript(
    ({ address, name }) => {
      const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
      const provider = {
        isMetaMask: false,
        request: (args: { method: string; params?: unknown[] }) =>
          (window as unknown as { __walletRequest: (a: unknown) => Promise<unknown> }).__walletRequest(args).then((r) => {
            if (args.method === "wallet_switchEthereumChain") (listeners["chainChanged"] ?? []).forEach((f) => f((args.params as { chainId: string }[])[0].chainId));
            return r;
          }),
        on: (e: string, f: (...a: unknown[]) => void) => ((listeners[e] ??= []).push(f), provider),
        removeListener: (e: string, f: (...a: unknown[]) => void) => ((listeners[e] = (listeners[e] ?? []).filter((x) => x !== f)), provider),
        address,
      };
      const info = {
        uuid: "350670db-19fa-4704-a166-e52e178b59d2",
        name,
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNiIgZmlsbD0iI2M4ZjA0YSIvPjwvc3ZnPg==",
        rdns: "test.lockage.wallet",
      };
      const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { address: account.address, name: opts.name ?? "Test Wallet" },
  );

  return { account, log, hashes, setChain: (id: number) => (chainId = id), get chainId() { return chainId; } };
}
