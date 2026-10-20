/**
 * Renders README.md from docs/README.template.md, replacing {{fact:path.to.value|fallback}} with values from
 * docs/FACTS.json. `--check` fails when the committed README differs from a fresh render, so no README number
 * can drift from FACTS.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const facts = JSON.parse(readFileSync("docs/FACTS.json", "utf8"));
const tpl = readFileSync("docs/README.template.md", "utf8");

const get = (path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), facts);

function fmt(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

const out = tpl.replace(/\{\{fact:([^}|]+)(?:\|([^}]*))?\}\}/g, (_m, path: string, fallback?: string) => {
  const v = path.startsWith("pct(") ? undefined : get(path.trim());
  if (v !== undefined && v !== null) return fmt(v);
  return fallback ?? "not run yet";
}).replace(/\{\{pct:([^,}]+),([^}]+)\}\}/g, (_m, a: string, b: string) => {
  const n = Number(get(a.trim()));
  const d = Number(get(b.trim()));
  if (!d || Number.isNaN(n) || Number.isNaN(d)) return "not run yet";
  const v = (n / d) * 100;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
});

if (process.argv.includes("--check")) {
  const cur = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
  if (cur !== out) {
    console.error("README.md is out of date with docs/FACTS.json. Run: npx tsx scripts/render-readme.ts");
    process.exit(1);
  }
  console.log("README matches FACTS");
} else {
  writeFileSync("README.md", out);
  console.log("README.md rendered");
}
