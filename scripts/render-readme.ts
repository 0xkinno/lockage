/**
 * Renders README.md from docs/README.template.md.
 *   {{fact:path.to.value|fallback}}   a value from docs/FACTS.json
 *   {{pct:path.a,path.b}}             a percentage of two FACTS values
 *   {{table:contracts|pairs|evidence}} link tables built from data/*.json
 * `--check` fails when the committed README differs from a fresh render, so no README number can drift from FACTS.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const facts = JSON.parse(readFileSync("docs/FACTS.json", "utf8"));
const readJson = (p: string, d: unknown) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const tpl = readFileSync("docs/README.template.md", "utf8");

const EL = "https://elysium.kinetiq.xyz/testnet-explorer";
const HE = "https://testnet.hyperevm-explorer.xyz";
const tick = "`";
const addrLink = (a: string, chain: "el" | "he" = "el") => `[${tick}${a.slice(0, 6)}...${a.slice(-4)}${tick}](${chain === "el" ? EL : HE}/address/${a})`;
const txLink = (h: string) => `[${tick}${h.slice(0, 10)}...${tick}](${EL}/tx/${h})`;

const ROLE: Record<string, string> = {
  LockSurvey: "Envelope math, metadata hash, seal",
  LockGate: "The enforcement point for crossings",
  LockLedger: "Builder decisions bound to a finding hash; holds",
  LockProbe: "Measures whether transfers deliver exactly what is sent",
  SealedToken: "Demo: fixed 1B supply, immutable metadata (the control)",
  DriftToken: "Demo: the owner can rename it (the drift case)",
  OversizeToken: "Demo: 1 quadrillion supply, cannot graduate",
  TaxToken: "Demo: 1% transfer tax",
  MintToken: "Demo: the owner can mint",
};

const tables: Record<string, () => string> = {
  contracts: () => {
    const c = (readJson("data/deployments.json", { contracts: {} }) as { contracts: Record<string, { address: string; txHash: string; gasUsed: string }> }).contracts;
    const rows = Object.entries(c).map(([n, v]) => `| ${tick}${n}${tick} | ${ROLE[n] ?? ""} | ${addrLink(v.address)} | ${txLink(v.txHash)} | ${Number(v.gasUsed).toLocaleString("en-US")} |`);
    return ["| Contract | Role | Address | Deploy tx | Gas |", "|---|---|---|---|---|", ...rows].join("\n");
  },
  pairs: () => {
    const p = (readJson("data/pairs.json", { rows: [] }) as { rows: { symbol: string; token: string; mirror: string; wallet: string | null; routed: boolean }[] }).rows;
    const rows = p.map((r) => `| ${r.symbol} | ${addrLink(r.token)} | ${addrLink(r.mirror, "he")} | ${r.wallet ? addrLink(r.wallet) : "none, by design"} | ${r.routed ? "registered" : "not bridged"} |`);
    return ["| Token | Elysium token | HyperEVM mirror | Escrow wallet | Router route |", "|---|---|---|---|---|", ...rows].join("\n");
  },
  evidence: () => {
    const cf = facts.counterfactual as null | Record<string, { txHash?: string }>;
    if (!cf) return "The counterfactual has not been run yet.";
    const r = (label: string, k: string, verdict: string) => `| ${label} | ${verdict} | ${cf[k]?.txHash ? txLink(cf[k].txHash!) : "n/a"} |`;
    return [
      "| Step | Outcome | Transaction |",
      "|---|---|---|",
      r("Raw router crossing before the rename", "rawPre", "Accepted"),
      r("Owner renames the token", "rename", "Mirror moves to a new address"),
      r("Raw router crossing keyed on the stale mirror", "baseline", "**Accepted**"),
      r("LockGate crossing of the immutable token (control)", "control", "Accepted"),
      r("LockGate crossing of the renamed token", "intervention", "**Refused: MetadataDrift**"),
    ].join("\n");
  },
};

const get = (path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), facts);
const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v));

const out = tpl
  .replace(/\{\{hype:([^}]+)\}\}/g, (_m, path: string) => {
    const v = get(path.trim());
    return v ? (Number(BigInt(String(v))) / 1e18).toFixed(5) : "not run yet";
  })
  .replace(/\{\{table:(\w+)\}\}/g, (_m, n: string) => (tables[n] ? tables[n]() : ""))
  .replace(/\{\{fact:([^}|]+)(?:\|([^}]*))?\}\}/g, (_m, path: string, fallback?: string) => {
    const v = get(path.trim());
    return v !== undefined && v !== null ? fmt(v) : (fallback ?? "not run yet");
  })
  .replace(/\{\{pct:([^,}]+),([^}]+)\}\}/g, (_m, a: string, b: string) => {
    const n = Number(get(a.trim()));
    const d = Number(get(b.trim()));
    if (!d || Number.isNaN(n) || Number.isNaN(d)) return "not run yet";
    const v = (n / d) * 100;
    return `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
  });

if (process.argv.includes("--check")) {
  const cur = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
  if (cur !== out) {
    console.error("README.md is out of date with docs/FACTS.json and data/*.json. Run: npx tsx scripts/render-readme.ts");
    process.exit(1);
  }
  console.log("README matches FACTS");
} else {
  writeFileSync("README.md", out);
  console.log("README.md rendered");
}
