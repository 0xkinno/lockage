/**
 * The Lockkeeper. Reads only: it holds no key and moves no funds. For every sealed token it reconciles
 * escrow against mirror supply plus pending messages and writes data/ledger.json. It asks the builder for a
 * decision only for identity drift, books that do not reconcile, or supply growth past the sealed envelope.
 * Scheduled by .github/workflows/lockkeeper.yml; the committed ledger is the unattended run.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { PublicClient } from "viem";
import { ely, he, rpcSource, sleep } from "./_env";
import { discoverSealed, reconcile, type KeeperRow } from "../src/lib/keeper";

const dep = JSON.parse(readFileSync("data/deployments.json", "utf8")) as { contracts: Record<string, { address: `0x${string}`; block: number }> };
if (!dep.contracts.LockSurvey) {
  console.log("LockSurvey is not deployed yet; nothing to keep.");
  process.exit(0);
}
const survey = dep.contracts.LockSurvey.address;
const fromBlock = BigInt(dep.contracts.LockSurvey.block);

type Ledger = {
  lastRun: string;
  rpcSource: { elysium: string; hyperevm: string };
  sweeps: number;
  decisionsAsked: number;
  askedHashes: string[];
  findings: { token: string; kind: string; detail: string; hash: string; firstSeen: string }[];
  rows: KeeperRow[];
  history: { at: string; tokens: number; open: number }[];
};
const prev: Ledger = existsSync("data/ledger.json")
  ? JSON.parse(readFileSync("data/ledger.json", "utf8"))
  : { lastRun: "", rpcSource, sweeps: 0, decisionsAsked: 0, askedHashes: [], findings: [], rows: [], history: [] };

const tokens = await discoverSealed(ely as PublicClient, survey, fromBlock);
const rows: KeeperRow[] = [];
for (const t of tokens) {
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      rows.push(await reconcile(ely as PublicClient, he as PublicClient, survey, t, fromBlock));
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await sleep(2000 * (i + 1));
    }
  }
  if (lastErr) console.error("could not reconcile", t, String((lastErr as Error).message).slice(0, 120));
}

// a token that could not be read this sweep keeps its last known row, flagged by its checkedAt time
for (const t of tokens) if (!rows.find((r) => r.token === t)) { const old = prev.rows.find((r) => r.token === t); if (old) rows.push(old); }
const at = new Date().toISOString();
const findings = rows.flatMap((r) =>
  r.findings.map((f) => ({ token: r.token, kind: f.kind, detail: f.detail, hash: f.hash, firstSeen: prev.findings.find((p) => p.hash === f.hash)?.firstSeen ?? at })),
);
const asked = new Set(prev.askedHashes);
for (const f of findings) asked.add(f.hash);

const ledger: Ledger = {
  lastRun: at,
  rpcSource,
  sweeps: prev.sweeps + 1,
  decisionsAsked: asked.size,
  askedHashes: [...asked],
  findings,
  rows,
  history: [...prev.history, { at, tokens: rows.length, open: findings.length }].slice(-200),
};
writeFileSync("data/ledger.json", JSON.stringify(ledger, null, 2));
console.log(`sweep ${ledger.sweeps}: ${rows.length} sealed tokens, ${findings.length} open findings, ${ledger.decisionsAsked} decisions ever asked; RPC: ${rpcSource.elysium}`);
for (const r of rows) for (const p of r.pairs) console.log(" ", r.symbol, p.canonical ? "canonical" : "older   ", p.mirror.slice(0, 10), "escrow", p.escrow, "supply", p.mirrorSupply, "pending", p.pending, "reconciles", p.reconciles);
if (rows.length < tokens.length) console.error(`${tokens.length - rows.length} token(s) could not be read this sweep; they keep their previous row`);
