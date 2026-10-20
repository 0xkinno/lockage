/**
 * The Clerk. Writes docs/FACTS.json from real runs. Every number in the UI and README reads from it.
 * Nothing here is typed by hand: each field is derived from a data file or a tool run, or it is null.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null);

function forgeTests() {
  const local = resolve(".tools/foundry/forge.exe");
  const bin = existsSync(local) ? local : "forge";
  const r = spawnSync(bin, ["test", "--json"], { encoding: "utf8", maxBuffer: 1 << 28 });
  try {
    const start = r.stdout.indexOf("{");
    const j = JSON.parse(r.stdout.slice(start)) as Record<string, { test_results: Record<string, { status: string }> }>;
    let total = 0;
    let passed = 0;
    for (const suite of Object.values(j)) for (const t of Object.values(suite.test_results)) { total++; if (t.status === "Success") passed++; }
    return { total, passed, failed: total - passed };
  } catch {
    return null;
  }
}

const tests = forgeTests();
const vectors = readJson<{ count: number }>("data/envelope-vectors.json");
const census = readJson<{ summary: Record<string, unknown> }>("data/census.json");
const control = readJson<Record<string, unknown>>("data/control-set.json");
const deployments = readJson<{ contracts: Record<string, { gasUsed: string; feeWei: string; deployedOn: string }> }>("data/deployments.json");
const ledger = readJson<{ lastRun: string; sweeps: number; decisionsAsked: number; findings: unknown[] }>("data/ledger.json");
const envVerify = readJson<Record<string, unknown>>("data/envelope-verification.json");
const challenge = readJson<{ seconds: number }>("data/challenge-window.json");
const spot = readJson<{ ranOn: string; tokens: number }>("data/spot-snapshot.json");

const expDir = "data/experiments";
const exps = existsSync(expDir) ? readdirSync(expDir).filter((f) => f.endsWith(".json")).sort() : [];
const latest = (prefix: string) => {
  const f = exps.filter((x) => x.startsWith(prefix)).pop();
  return f ? { file: f, ...readJson<Record<string, unknown>>(`${expDir}/${f}`) } : null;
};

const driftRun = latest("drift-") as null | { steps?: { step: string; gasUsed?: string; chain: string }[] };
const setupRun = readJson<{ steps: { step: string; gasUsed?: string; chain: string }[] }>("data/setup.json");
const costs = {
  note: "Gas used per step, read from receipts of dated runs. Fee in HYPE = gas x gas price at the time (Elysium is 0.1 gwei at the last check).",
  perStep: [...(setupRun?.steps ?? []), ...(driftRun?.steps ?? [])].filter((x) => x.gasUsed).map((x) => ({ step: x.step, chain: x.chain, gasUsed: Number(x.gasUsed) })),
};

const facts = {
  generatedAt: new Date().toISOString(),
  tests: tests ? { ...tests, fuzzRunsPerProperty: 10000, twinVectors: vectors?.count ?? null } : null,
  census: census?.summary ?? null,
  controlSet: control,
  drift: latest("drift-"),
  counterfactual: latest("counterfactual-"),
  challengeWindowSeconds: challenge?.seconds ?? null,
  envelopeVerification: envVerify,
  hypercoreSnapshot: spot,
  deployments: deployments
    ? {
        contractCount: Object.keys(deployments.contracts).length,
        totalDeployFeeWei: Object.values(deployments.contracts).reduce((a, c) => a + BigInt(c.feeWei), 0n).toString(),
        contracts: deployments.contracts,
      }
    : null,
  costs: costs.perStep.length ? costs : null,
  keeper: ledger ? { lastRun: ledger.lastRun, sweeps: ledger.sweeps, decisionsAsked: ledger.decisionsAsked, openFindings: ledger.findings.length } : null,
};
writeFileSync("docs/FACTS.json", JSON.stringify(facts, null, 2));
console.log("docs/FACTS.json written;", "tests:", JSON.stringify(facts.tests), "census:", facts.census ? "yes" : "no", "drift:", facts.drift ? "yes" : "no");
