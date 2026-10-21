import { config } from "dotenv";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { elysiumTestnet, hyperEvmTestnet } from "../src/lib/chains";

config({ path: ".env", quiet: true });

const elyRpc = process.env.CONDUIT_RPC || process.env.NEXT_PUBLIC_ELYSIUM_RPC || "https://testnet-rpc.elysium.kinetiq.xyz";
const heRpc = process.env.NEXT_PUBLIC_HYPEREVM_RPC || "https://rpc.hyperliquid-testnet.xyz/evm";

/** Which RPC answered: named in the ledger, never silent. */
export const rpcSource = {
  elysium: new URL(elyRpc).host + (process.env.CONDUIT_RPC ? " (CONDUIT_RPC secret)" : " (public RPC, no CONDUIT_RPC secret set)"),
  hyperevm: new URL(heRpc).host + " (public RPC)",
};

export const ely = createPublicClient({ chain: elysiumTestnet, transport: http(elyRpc, { retryCount: 4, retryDelay: 400, timeout: 45_000 }) });
export const he = createPublicClient({ chain: hyperEvmTestnet, transport: http(heRpc, { retryCount: 4, retryDelay: 400, timeout: 45_000 }) });

export function account(name: "DEPLOYER_PK" | "BUILDER_PK" | "HOLDER_PK" | "KEEPER_PK") {
  const pk = process.env[name] as Hex | undefined;
  if (!pk) throw new Error(`${name} missing from .env`);
  return privateKeyToAccount(pk);
}

export function walletFor(name: "DEPLOYER_PK" | "BUILDER_PK" | "HOLDER_PK" | "KEEPER_PK", chain: "ely" | "he") {
  const a = account(name);
  return createWalletClient({
    account: a,
    chain: chain === "ely" ? elysiumTestnet : hyperEvmTestnet,
    transport: http(chain === "ely" ? elyRpc : heRpc, { retryCount: 3, retryDelay: 400, timeout: 60_000 }),
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const today = () => new Date().toISOString().slice(0, 10);
