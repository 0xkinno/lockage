import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { elyClient, heClient } from "./clients";
import { ADDR } from "./chains";
import { LOCK } from "./deployments";
import { bridgeFactoryAbi, erc20Abi, lockGateAbi, lockLedgerAbi, lockSurveyAbi, mirrorFactoryAbi, routerAbi } from "./abi";
import { scan as gauge, EIP1967_ADMIN_SLOT, EIP1967_IMPL_SLOT, type Scan } from "./bytecode";
import { envelope } from "./envelope";

export type TokenInfo = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: Address | null;
  codeSize: number;
  scan: Scan;
  proxyImpl: Address | null;
};

export class NotAnErc20 extends Error {}

export function parseAddress(raw: string): Address | null {
  const t = raw.trim();
  return isAddress(t) ? getAddress(t) : null;
}

export async function readToken(address: Address): Promise<TokenInfo> {
  const code = (await elyClient.getCode({ address })) ?? "0x";
  if (code === "0x") throw new NotAnErc20("No contract at this address on Elysium testnet.");
  const r = await elyClient.multicall({
    allowFailure: true,
    contracts: [
      { address, abi: erc20Abi, functionName: "name" },
      { address, abi: erc20Abi, functionName: "symbol" },
      { address, abi: erc20Abi, functionName: "decimals" },
      { address, abi: erc20Abi, functionName: "totalSupply" },
      { address, abi: erc20Abi, functionName: "owner" },
    ],
  });
  if (r[0].status !== "success" || r[1].status !== "success" || r[2].status !== "success" || r[3].status !== "success") {
    throw new NotAnErc20("This contract does not answer name, symbol, decimals and totalSupply. The mirror bridge needs all four.");
  }
  const codeSize = (code.length - 2) / 2;
  let proxyImpl: Address | null = null;
  let implCode: Hex | null = null;
  if (codeSize < 400) {
    const slot = await elyClient.getStorageAt({ address, slot: EIP1967_IMPL_SLOT });
    if (slot && /[1-9a-f]/i.test(slot.slice(2))) {
      proxyImpl = getAddress(("0x" + slot.slice(26)) as Hex);
      implCode = ((await elyClient.getCode({ address: proxyImpl })) ?? null) as Hex | null;
    }
  }
  let proxyAdmin: Address | null = null;
  if (codeSize < 400 || proxyImpl) {
    const a = await elyClient.getStorageAt({ address, slot: EIP1967_ADMIN_SLOT }).catch(() => null);
    if (a && /[1-9a-f]/i.test(a.slice(2))) proxyAdmin = getAddress(("0x" + a.slice(26)) as Hex);
  }
  const scanned = gauge(code as Hex, implCode);
  scanned.proxyAdmin = proxyAdmin;
  return {
    address,
    name: r[0].result as string,
    symbol: r[1].result as string,
    decimals: Number(r[2].result),
    totalSupply: r[3].result as bigint,
    owner: r[4].status === "success" ? (r[4].result as Address) : null,
    codeSize,
    scan: scanned,
    proxyImpl,
  };
}

export type Pair = { mirror: Address; wallet: Address | null; gateway: Address | null; routed: boolean };

export async function readPair(token: Address): Promise<Pair> {
  const [mirror, wallet] = await Promise.all([
    elyClient.readContract({ address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "expectedL1Mirror", args: [token] }),
    elyClient.readContract({ address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "l2WalletFor", args: [token] }),
  ]);
  let gateway: Address | null = null;
  try {
    gateway = await elyClient.readContract({ address: ADDR.elysium.router, abi: routerAbi, functionName: "getGateway", args: [mirror] });
  } catch {
    gateway = null;
  }
  return {
    mirror,
    wallet: wallet === zeroAddress ? null : wallet,
    gateway,
    routed: !!gateway && gateway.toLowerCase() === ADDR.elysium.walletGateway.toLowerCase(),
  };
}

export type SealInfo = {
  sealed: boolean;
  metaHash: Hex;
  mirror: Address;
  sealedAt: number;
  sealedBy: Address;
  supplyAtSeal: bigint;
  graduates: boolean;
};

export async function readSeal(token: Address): Promise<SealInfo | null> {
  if (!LOCK.survey) return null;
  const [mh, mirror, at, by, supply, grad] = await elyClient.readContract({ address: LOCK.survey, abi: lockSurveyAbi, functionName: "sealOf", args: [token] });
  return { sealed: at !== 0n, metaHash: mh, mirror, sealedAt: Number(at), sealedBy: by, supplyAtSeal: supply, graduates: grad };
}

export async function readLiveMetaHash(token: Address): Promise<Hex | null> {
  if (!LOCK.survey) return null;
  try {
    return await elyClient.readContract({ address: LOCK.survey, abi: lockSurveyAbi, functionName: "metaHash", args: [token] });
  } catch {
    return null;
  }
}

export type Decision = { kind: 0 | 1 | 2; findingHash: Hex; by: Address; at: number; note: string };

export async function readDecision(token: Address): Promise<Decision | null> {
  if (!LOCK.ledger) return null;
  const d = await elyClient.readContract({ address: LOCK.ledger, abi: lockLedgerAbi, functionName: "decisionOf", args: [token] });
  return { kind: Number(d.kind) as 0 | 1 | 2, findingHash: d.findingHash, by: d.by, at: Number(d.at), note: d.note };
}

export type CheckId = "sealed" | "hold" | "identity" | "envelope" | "route";
export type Check = { id: CheckId; title: string; ok: boolean; detail: string };

/** The five pre-flight checks, computed client-side from live reads and cross-checked with LockGate.preflight. */
export async function preflightChecks(token: Address): Promise<{ checks: Check[]; onChain: number | null; mirror: Address | null; wallet: Address | null; ok: boolean }> {
  const [info, seal, pair, live, dec] = await Promise.all([readToken(token), readSeal(token), readPair(token), readLiveMetaHash(token), readDecision(token)]);
  const checks: Check[] = [];
  const sealed = !!seal?.sealed;
  checks.push({ id: "sealed", title: "Sealed", ok: sealed, detail: sealed ? "A seal exists for this token." : "Not sealed. Survey and seal the token first." });
  const held = dec?.kind === 2;
  checks.push({ id: "hold", title: "No builder hold", ok: !held, detail: held ? `The builder placed a hold: ${dec?.note || "no note"}` : "The builder has not paused crossings." });
  const metaSame = !!seal?.sealed && !!live && live === seal.metaHash;
  const mirrorSame = !!seal?.sealed && seal.mirror.toLowerCase() === pair.mirror.toLowerCase();
  checks.push({
    id: "identity",
    title: "Identity unchanged",
    ok: metaSame && mirrorSame,
    detail: !sealed
      ? "Nothing to compare until the token is sealed."
      : !metaSame
        ? "Name, symbol or decimals changed since the seal. The canonical mirror moved."
        : !mirrorSame
          ? "The factory now names a different mirror than the one sealed."
          : "Metadata hash and canonical mirror match the seal.",
  });
  const envNow = envelope(info.decimals, info.totalSupply);
  const envOk = !seal?.graduates || envNow.graduates;
  checks.push({
    id: "envelope",
    title: "Envelope intact",
    ok: !!seal?.sealed && envOk,
    detail: !sealed ? "Nothing to compare until the token is sealed." : envOk ? "Supply still fits the sealed graduation envelope." : "Supply grew past the sealed envelope.",
  });
  const routeOk = !!pair.wallet && pair.routed;
  checks.push({
    id: "route",
    title: "Route registered",
    ok: routeOk,
    detail: !pair.wallet ? "The escrow wallet has not been deployed yet." : pair.routed ? "The router sends this mirror through the bridge-wallet gateway." : "The router does not yet point this mirror at the bridge-wallet gateway.",
  });
  let onChain: number | null = null;
  if (LOCK.gate) {
    try {
      const [code] = await elyClient.readContract({ address: LOCK.gate, abi: lockGateAbi, functionName: "preflight", args: [token] });
      onChain = Number(code);
    } catch {
      onChain = null;
    }
  }
  return { checks, onChain, mirror: pair.mirror, wallet: pair.wallet, ok: checks.every((c) => c.ok) };
}

export async function mirrorSupply(mirror: Address): Promise<bigint | null> {
  try {
    return await heClient.readContract({ address: mirror, abi: erc20Abi, functionName: "totalSupply" });
  } catch {
    return null;
  }
}

export async function balanceOf(token: Address, who: Address): Promise<bigint> {
  return elyClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });
}

export type PairView = { mirror: Address; wallet: Address | null; canonical: boolean; escrow: bigint };

/** Every pair the token owns: the one it was sealed with and the one the factory names now. */
export async function readPairs(token: Address, sealedMirror: Address | null): Promise<PairView[]> {
  const cur = await readPair(token);
  const out: PairView[] = [];
  const mirrors = [cur.mirror, ...(sealedMirror && sealedMirror.toLowerCase() !== cur.mirror.toLowerCase() ? [sealedMirror] : [])];
  for (const m of mirrors) {
    const canonical = m.toLowerCase() === cur.mirror.toLowerCase();
    let wallet: Address | null = canonical ? cur.wallet : null;
    if (!canonical) {
      try {
        const w = await heClient.readContract({ address: ADDR.hyperevm.mirrorFactory, abi: mirrorFactoryAbi, functionName: "expectedL2Wallet", args: [m] });
        wallet = w === zeroAddress ? null : (w as Address);
      } catch {
        wallet = null;
      }
    }
    const escrow = wallet ? await elyClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }) : 0n;
    out.push({ mirror: m, wallet, canonical, escrow });
  }
  return out;
}
