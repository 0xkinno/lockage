import { decodeAbiParameters, keccak256, toHex, type Address, type Hex, type PublicClient } from "viem";
import { ADDR } from "./chains";
import { arbSysAbi, erc20Abi, lockSurveyAbi, mirrorFactoryAbi } from "./abi";
import { envelope } from "./envelope";

/** The Lockkeeper's reconciliation, shared by scripts/lockkeeper.ts (scheduled) and the /keeper page (live read). */

export type Finding = {
  kind: "identity" | "books" | "growth";
  detail: string;
  /** keccak of the canonical finding. The builder signs a decision bound to this exact hash. */
  hash: Hex;
};

/** One escrow wallet and its mirror. A token whose metadata changed owns more than one. */
export type PairState = {
  mirror: Address;
  wallet: Address | null;
  /** true for the pair the factory names canonical for the token's CURRENT metadata */
  canonical: boolean;
  /** true for the pair the token was sealed with */
  sealed: boolean;
  escrow: string;
  mirrorSupply: string | null;
  pending: string | null;
  pendingNote: string;
  reconciles: boolean | null;
};

export type KeeperRow = {
  token: Address;
  symbol: string;
  sealedBy: Address;
  /** totals across every pair, kept for the summary line */
  escrow: string;
  mirrorSupply: string | null;
  pending: string | null;
  pendingNote: string;
  pairs: PairState[];
  status: "reconciled" | "in-flight" | "finding" | "abstain";
  findings: Finding[];
  checkedAt: string;
};

const outboxAbi = [{ type: "function", name: "isSpent", stateMutability: "view", inputs: [{ name: "index", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;
const factoryAbi = [
  { type: "function", name: "expectedL1Mirror", stateMutability: "view", inputs: [{ name: "elysiumToken", type: "address" }], outputs: [{ type: "address" }] },
  { type: "function", name: "l2WalletFor", stateMutability: "view", inputs: [{ name: "elysiumToken", type: "address" }], outputs: [{ type: "address" }] },
] as const;

const FINALIZE_SELECTOR = "0x2e567b36"; // finalizeInboundTransfer(address,address,address,uint256,bytes)
const ZERO = "0x0000000000000000000000000000000000000000";

export const findingHash = (parts: Record<string, string>): Hex => keccak256(toHex(JSON.stringify(parts, Object.keys(parts).sort())));

const fmt18 = (v: bigint) => {
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
};

async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw last;
}

/**
 * Sum of amounts sent from Elysium to the mirror gateway for `mirror` that the HyperEVM Outbox has not yet executed.
 * Returns null (abstain) when it cannot be determined, never a guess.
 */
export async function pendingAmount(ely: PublicClient, he: PublicClient, mirror: Address, fromBlock: bigint): Promise<{ amount: bigint | null; note: string }> {
  try {
    const logs = await withRetry(() =>
      ely.getContractEvents({ address: ADDR.elysium.arbSys, abi: arbSysAbi, eventName: "L2ToL1Tx", args: { destination: ADDR.hyperevm.mirrorGateway }, fromBlock, toBlock: "latest" }),
    );
    let total = 0n;
    let counted = 0;
    for (const l of logs) {
      const data = l.args.data as Hex | undefined;
      if (!data || !data.startsWith(FINALIZE_SELECTOR)) continue;
      const [token, , , amount] = decodeAbiParameters(
        [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
        ("0x" + data.slice(10)) as Hex,
      );
      if (token.toLowerCase() !== mirror.toLowerCase()) continue;
      const spent = await withRetry(() => he.readContract({ address: ADDR.hyperevm.outbox, abi: outboxAbi, functionName: "isSpent", args: [l.args.position as bigint] }));
      counted++;
      if (!spent) total += amount;
    }
    return { amount: total, note: `${counted} outbound message${counted === 1 ? "" : "s"} for this mirror, ${total === 0n ? "all executed" : "some still waiting"}` };
  } catch (e) {
    return { amount: null, note: "Pending messages could not be read: " + (e as Error).message.split("\n")[0].slice(0, 100) };
  }
}

export async function discoverSealed(ely: PublicClient, survey: Address, fromBlock: bigint): Promise<Address[]> {
  const logs = await withRetry(() => ely.getContractEvents({ address: survey, abi: lockSurveyAbi, eventName: "Sealed", fromBlock, toBlock: "latest" }));
  return [...new Set(logs.map((l) => l.args.token as Address))];
}

export async function reconcile(ely: PublicClient, he: PublicClient, survey: Address, token: Address, fromBlock: bigint): Promise<KeeperRow> {
  const [seal, symbol, live, supplyNow, decimals, canonicalMirror, canonicalWallet] = await withRetry(() =>
    Promise.all([
      ely.readContract({ address: survey, abi: lockSurveyAbi, functionName: "sealOf", args: [token] }),
      ely.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      ely.readContract({ address: survey, abi: lockSurveyAbi, functionName: "metaHash", args: [token] }),
      ely.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
      ely.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      ely.readContract({ address: ADDR.elysium.bridgeFactory, abi: factoryAbi, functionName: "expectedL1Mirror", args: [token] }),
      ely.readContract({ address: ADDR.elysium.bridgeFactory, abi: factoryAbi, functionName: "l2WalletFor", args: [token] }),
    ]),
  );
  const [sealedHash, sealedMirror, , sealedBy, supplyAtSeal, sealedGrad] = seal;
  const findings: Finding[] = [];
  const checkedAt = new Date().toISOString();

  // every pair this token has ever had: the one it was sealed with, and the one the factory names now
  const mirrors = [...new Set([sealedMirror.toLowerCase(), canonicalMirror.toLowerCase()])].map((m) => (m === sealedMirror.toLowerCase() ? sealedMirror : canonicalMirror));
  const pairs: PairState[] = [];
  for (const mirror of mirrors) {
    const isCanonical = mirror.toLowerCase() === canonicalMirror.toLowerCase();
    let wallet: Address | null = null;
    if (isCanonical && canonicalWallet !== ZERO) wallet = canonicalWallet;
    else {
      // the wallet of an older identity: the mirror factory derives it from the mirror alone
      try {
        const w = await withRetry(() => he.readContract({ address: ADDR.hyperevm.mirrorFactory, abi: mirrorFactoryAbi, functionName: "expectedL2Wallet", args: [mirror] }));
        wallet = w === ZERO ? null : (w as Address);
      } catch {
        wallet = null;
      }
    }
    const escrow = wallet ? await withRetry(() => ely.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [wallet as Address] })) : 0n;
    let mirrorSupply: bigint | null = null;
    try {
      mirrorSupply = await withRetry(() => he.readContract({ address: mirror, abi: erc20Abi, functionName: "totalSupply" }), 2);
    } catch {
      mirrorSupply = null; // the mirror is not deployed on HyperEVM yet
    }
    const p = mirrorSupply === null ? { amount: null as bigint | null, note: "Mirror not deployed on HyperEVM yet." } : await pendingAmount(ely, he, mirror, fromBlock);
    const reconciles = mirrorSupply === null || p.amount === null ? (escrow === 0n ? true : null) : escrow === mirrorSupply + p.amount;
    pairs.push({
      mirror,
      wallet,
      canonical: isCanonical,
      sealed: mirror.toLowerCase() === sealedMirror.toLowerCase(),
      escrow: escrow.toString(),
      mirrorSupply: mirrorSupply?.toString() ?? null,
      pending: p.amount?.toString() ?? null,
      pendingNote: p.note,
      reconciles,
    });
  }

  if (live !== sealedHash) {
    const old = pairs.find((p) => !p.canonical);
    const stranded = old ? BigInt(old.escrow) : 0n;
    const detail =
      old && stranded > 0n
        ? `${fmt18(stranded)} ${symbol} are locked behind the token's old identity: wallet ${old.wallet}, mirror ${old.mirror}. The canonical mirror is now ${canonicalMirror}. Holders of the old mirror cannot be served by the new route.`
        : `Live name, symbol or decimals no longer match the seal. The canonical mirror moved from ${sealedMirror} to ${canonicalMirror}.`;
    findings.push({ kind: "identity", detail, hash: findingHash({ token, kind: "identity", sealed: sealedHash, live }) });
  }
  if (supplyNow > supplyAtSeal && sealedGrad && !envelope(Number(decimals), supplyNow).graduates) {
    findings.push({ kind: "growth", detail: "Supply grew past the sealed graduation envelope.", hash: findingHash({ token, kind: "growth", sealed: supplyAtSeal.toString(), live: supplyNow.toString() }) });
  }
  // books are reconciled per pair: a pair whose own escrow does not match its own mirror is a real books finding
  for (const p of pairs) {
    if (p.reconciles === false) {
      findings.push({
        kind: "books",
        detail: `Pair ${p.mirror}: escrow ${p.escrow} does not equal mirror supply ${p.mirrorSupply} plus pending ${p.pending}.`,
        hash: findingHash({ token, kind: "books", mirror: p.mirror, escrow: p.escrow, supply: p.mirrorSupply ?? "", pending: p.pending ?? "" }),
      });
    }
  }

  const sum = (f: (p: PairState) => string | null) => pairs.reduce<bigint | null>((a, p) => (a === null || f(p) === null ? null : a + BigInt(f(p) as string)), 0n);
  let status: KeeperRow["status"] = "reconciled";
  if (findings.length) status = "finding";
  else if (pairs.some((p) => p.reconciles === null)) status = "abstain";
  else if (pairs.some((p) => BigInt(p.pending ?? "0") > 0n)) status = "in-flight";

  return {
    token,
    symbol,
    sealedBy,
    escrow: sum((p) => p.escrow)?.toString() ?? "0",
    mirrorSupply: sum((p) => p.mirrorSupply)?.toString() ?? null,
    pending: sum((p) => p.pending)?.toString() ?? null,
    pendingNote: pairs.map((p) => p.pendingNote).join("; "),
    pairs,
    status,
    findings,
    checkedAt,
  };
}
