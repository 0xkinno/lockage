import { decodeAbiParameters, keccak256, toHex, type Address, type Hex, type PublicClient } from "viem";
import { ADDR } from "./chains";
import { arbSysAbi, bridgeFactoryAbi, erc20Abi, lockSurveyAbi } from "./abi";
import { envelope } from "./envelope";

/** The Lockkeeper's reconciliation, shared by scripts/lockkeeper.ts (scheduled) and the /keeper page (live read). */

export type Finding = {
  kind: "identity" | "books" | "growth";
  detail: string;
  /** keccak of the canonical finding. The builder signs a decision bound to this exact hash. */
  hash: Hex;
};

export type KeeperRow = {
  token: Address;
  symbol: string;
  sealedBy: Address;
  escrow: string;
  mirrorSupply: string | null;
  pending: string | null;
  pendingNote: string;
  status: "reconciled" | "in-flight" | "finding" | "abstain";
  findings: Finding[];
  checkedAt: string;
};

const outboxAbi = [{ type: "function", name: "isSpent", stateMutability: "view", inputs: [{ name: "index", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;

const FINALIZE_SELECTOR = "0x2e567b36"; // finalizeInboundTransfer(address,address,address,uint256,bytes)

export const findingHash = (parts: Record<string, string>): Hex => keccak256(toHex(JSON.stringify(parts, Object.keys(parts).sort())));

/**
 * Sum of amounts sent from Elysium to the mirror gateway for `mirror` that the HyperEVM Outbox has not yet executed.
 * Returns null (abstain) when it cannot be determined, never a guess.
 */
export async function pendingAmount(ely: PublicClient, he: PublicClient, mirror: Address, fromBlock: bigint): Promise<{ amount: bigint | null; note: string }> {
  try {
    const logs = await ely.getContractEvents({
      address: ADDR.elysium.arbSys,
      abi: arbSysAbi,
      eventName: "L2ToL1Tx",
      args: { destination: ADDR.hyperevm.mirrorGateway },
      fromBlock,
      toBlock: "latest",
    });
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
      const spent = await he.readContract({ address: ADDR.hyperevm.outbox, abi: outboxAbi, functionName: "isSpent", args: [l.args.position as bigint] });
      counted++;
      if (!spent) total += amount;
    }
    return { amount: total, note: `${counted} outbound message${counted === 1 ? "" : "s"} for this mirror, ${total === 0n ? "all executed" : "some still waiting"}` };
  } catch (e) {
    return { amount: null, note: "Pending messages could not be read: " + (e as Error).message.split("\n")[0].slice(0, 100) };
  }
}

export async function discoverSealed(ely: PublicClient, survey: Address, fromBlock: bigint): Promise<Address[]> {
  const logs = await ely.getContractEvents({ address: survey, abi: lockSurveyAbi, eventName: "Sealed", fromBlock, toBlock: "latest" });
  return [...new Set(logs.map((l) => l.args.token as Address))];
}

export async function reconcile(ely: PublicClient, he: PublicClient, survey: Address, token: Address, fromBlock: bigint): Promise<KeeperRow> {
  const [seal, symbol, live, supplyNow, decimals, wallet] = await Promise.all([
    ely.readContract({ address: survey, abi: lockSurveyAbi, functionName: "sealOf", args: [token] }),
    ely.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    ely.readContract({ address: survey, abi: lockSurveyAbi, functionName: "metaHash", args: [token] }),
    ely.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
    ely.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    ely.readContract({ address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "l2WalletFor", args: [token] }),
  ]);
  const [sealedHash, sealedMirror, , sealedBy, supplyAtSeal, sealedGrad] = seal;
  const findings: Finding[] = [];
  const checkedAt = new Date().toISOString();

  if (live !== sealedHash) {
    findings.push({ kind: "identity", detail: "Live name, symbol or decimals no longer match the seal. The canonical mirror moved.", hash: findingHash({ token, kind: "identity", sealed: sealedHash, live }) });
  }
  if (supplyNow > supplyAtSeal && sealedGrad && !envelope(Number(decimals), supplyNow).graduates) {
    findings.push({ kind: "growth", detail: "Supply grew past the sealed graduation envelope.", hash: findingHash({ token, kind: "growth", sealed: supplyAtSeal.toString(), live: supplyNow.toString() }) });
  }

  const noWallet = wallet === "0x0000000000000000000000000000000000000000";
  const escrow = noWallet ? 0n : await ely.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
  let mirrorSupply: bigint | null = null;
  try {
    mirrorSupply = await he.readContract({ address: sealedMirror, abi: erc20Abi, functionName: "totalSupply" });
  } catch {
    mirrorSupply = null; // the mirror is not deployed on HyperEVM yet
  }
  const p = mirrorSupply === null ? { amount: null as bigint | null, note: "Mirror not deployed on HyperEVM yet." } : await pendingAmount(ely, he, sealedMirror, fromBlock);

  let status: KeeperRow["status"] = "reconciled";
  if (mirrorSupply === null) {
    status = "abstain";
  } else if (p.amount === null) {
    status = escrow === mirrorSupply ? "reconciled" : "abstain";
  } else if (escrow === mirrorSupply + p.amount) {
    status = p.amount > 0n ? "in-flight" : "reconciled";
  } else {
    status = "finding";
    findings.push({
      kind: "books",
      detail: `Escrow ${escrow} does not equal mirror supply ${mirrorSupply} plus pending ${p.amount}.`,
      hash: findingHash({ token, kind: "books", escrow: escrow.toString(), mirror: mirrorSupply.toString(), pending: p.amount.toString() }),
    });
  }
  if (findings.length && status !== "finding") status = "finding";

  return {
    token,
    symbol,
    sealedBy,
    escrow: escrow.toString(),
    mirrorSupply: mirrorSupply?.toString() ?? null,
    pending: p.amount?.toString() ?? null,
    pendingNote: p.note,
    status,
    findings,
    checkedAt,
  };
}

