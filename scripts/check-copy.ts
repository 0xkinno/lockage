/**
 * House style and hygiene gate. Fails on:
 *  - em dash, en dash, emoji (README, docs, src, scripts, contracts)
 *  - banned marketing words
 *  - names listed in reference/BANNED_NAMES.txt (gitignored; other entries must never appear in committed files)
 *  - any AI-assistant attribution in committed files
 *  - private-key shaped strings
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOTS = ["README.md", "docs", "src", "scripts", "contracts", "tests", ".github", ".githooks", "data/wallets.json", "package.json", "foundry.toml"];
const SKIP = new Set(["node_modules", ".next", "out", "cache", "lib", ".tools", "broadcast", "reference", "FACTS.json", "census-public.json", "census.json", "census-addresses.json", "envelope-vectors.json", "artifacts.json", "abi.ts", "spotMeta-testnet.json", "check-copy.ts"]);
const EXT = /\.(md|ts|tsx|sol|json|yml|yaml|mjs|css|toml)$/;
const BANNED_WORDS = ["revolutionary", "seamless", "cutting-edge", "world-class", "military-grade", "zero-trust", "nanosecond", "paradigm"];
const EM = /[—–]/;
const EMOJI = /\p{Extended_Pictographic}/u;
const PK = /0x[a-fA-F0-9]{64}\b/;
const ATTRIB = /claude|anthropic/i;

function walk(p: string, out: string[]) {
  if (!existsSync(p)) return;
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) if (!SKIP.has(f)) walk(join(p, f), out);
  } else if (EXT.test(p) && !SKIP.has(p.split(/[\\/]/).pop()!)) out.push(p);
}

const files: string[] = [];
for (const r of ROOTS) walk(r, files);

const banned = existsSync("reference/BANNED_NAMES.txt") ? readFileSync("reference/BANNED_NAMES.txt", "utf8").split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
let bad = 0;
const fail = (f: string, line: number, why: string) => {
  bad++;
  console.log(`FAIL ${f}:${line} ${why}`);
};

for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  const isHook = f.includes("githooks") || f.includes("no-claude-attribution");
  lines.forEach((l, i) => {
    const low = l.toLowerCase();
    if (EM.test(l)) fail(f, i + 1, "em or en dash");
    if (EMOJI.test(l) && !/[✓→←↑↓]/.test(l.replace(/\p{Extended_Pictographic}/gu, (m) => (/[✓→]/.test(m) ? "" : m)))) fail(f, i + 1, "emoji");
    for (const w of BANNED_WORDS) if (low.includes(w)) fail(f, i + 1, `banned word "${w}"`);
    for (const n of banned) if (n && low.includes(n)) fail(f, i + 1, "other-entry name from BANNED_NAMES");
    if (!isHook && ATTRIB.test(l) && !f.endsWith("check-copy.ts")) fail(f, i + 1, "assistant attribution");
    if (PK.test(l) && !/hash|txHash|0x[a-f0-9]{64}.*(tx|block|root)/i.test(l) && /pk|private|secret/i.test(l)) fail(f, i + 1, "private key shaped string");
  });
}

// commit identity: every commit must be authored and committed by 0xkinno
const log = spawnSync("git", ["log", "--format=%an|%ae|%cn|%ce"], { encoding: "utf8" });
if (log.status === 0) {
  for (const row of log.stdout.split("\n").filter(Boolean)) {
    const [an, , cn] = row.split("|");
    if (an !== "0xkinno" || cn !== "0xkinno") fail("git log", 0, `commit not authored by 0xkinno: ${row}`);
  }
}

console.log(bad ? `\ncheck-copy: ${bad} problem(s) in ${files.length} files` : `check-copy: clean (${files.length} files, ${banned.length} banned names, commit identities checked)`);
process.exit(bad ? 1 : 0);
