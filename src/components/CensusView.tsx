"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import data from "../../data/census-public.json";
import { pct } from "@/lib/facts";
import { Addr, Label, Pending, Plate } from "./ui";

type Row = {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  verdict: "pass" | "block" | "unknown" | "invalid";
  blocks: string[];
  unknowns: string[];
  flags: string[];
  bestWei: number | null;
  logs: number;
};
type Summary = Record<string, number | string>;
const d = data as unknown as { summary: Summary | null; tokens: Row[]; misses: { address: string; note: string }[]; notes?: string[] };

const FILTERS = ["all", "pass", "block", "unknown"] as const;
const LABEL = { all: "All", pass: "Passes", block: "Blocks", unknown: "Not determined" } as const;

function whole(supply: string | null, dec: number | null) {
  if (!supply || dec === null) return "n/a";
  const v = BigInt(supply) / 10n ** BigInt(dec);
  return v > 10n ** 15n ? v.toString().slice(0, 4) + "e" + (v.toString().length - 1) : v.toLocaleString("en-US");
}

export function CensusView() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(100);
  const s = d.summary as unknown as Record<string, number & string> | null;

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.tokens.filter((r) => (f === "all" || r.verdict === f) && (!t || [r.symbol, r.name, r.address].some((x) => x?.toLowerCase().includes(t))));
  }, [f, q]);

  if (!s) {
    return (
      <div className="wrap">
        <Pending what="The census has not run yet." how="npm run census scans every Transfer log on Elysium testnet, surveys the active tokens, and publishes the counts and the heuristic's misses." />
      </div>
    );
  }
  const tiles: [string, number | string, string?][] = [
    ["Token contracts seen", Number(s.candidates).toLocaleString("en-US"), "Every address that emitted an ERC-20 Transfer"],
    ["Surveyed", Number(s.surveyed).toLocaleString("en-US"), `Active tokens, at least ${s.minTransfers} transfers`],
    ["Can graduate as-is", pct(Number(s.canGraduateAsIs), Number(s.surveyed)) ?? "n/a", `${Number(s.canGraduateAsIs).toLocaleString("en-US")} tokens pass all lines`],
    ["Blocked by supply or decimals", pct(Number(s.blockedBySupplyOrDecimals), Number(s.surveyed)) ?? "n/a", "No weiDecimals plan exists"],
    ["Mutable metadata", pct(Number(s.mutableMetadata), Number(s.surveyed)) ?? "n/a", "rename selectors found"],
    ["Owner mint", pct(Number(s.mintable), Number(s.surveyed)) ?? "n/a", "mint selectors found"],
  ];

  return (
    <div className="wrap pb-10 grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="census-tiles">
        {tiles.map(([k, v, sub]) => (
          <Plate key={k}>
            <Label>{k}</Label>
            <div className="display text-[52px] mt-1">{v}</div>
            {sub && <p className="text-[13px] text-muted">{sub}</p>}
          </Plate>
        ))}
      </div>
      <p className="text-[13px] text-muted max-w-3xl">
        Run on {String(s.ranOn)} at block {Number(s.headBlock).toLocaleString("en-US")}. The scan reads Transfer logs, so a contract that never emitted one is not seen. The survey is a bytecode selector scan: it names what it can find and cannot prove a negative. See the misses below.
      </p>

      <Plate hover={false}>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div role="tablist" aria-label="Verdict filter" className="inline-flex rounded-full border border-hairline p-1 bg-paper">
            {FILTERS.map((k) => (
              <button key={k} role="tab" aria-selected={f === k} data-testid={`filter-${k}`} onClick={() => { setF(k); setShown(100); }} className="px-4 h-9 rounded-full text-[13px] font-medium" style={f === k ? { background: "var(--ink)", color: "var(--paper)" } : { color: "var(--ink-2)" }}>
                {LABEL[k]}
              </button>
            ))}
          </div>
          <input className="field max-w-xs" placeholder="Search symbol, name or address" value={q} onChange={(e) => { setQ(e.target.value); setShown(100); }} aria-label="Search tokens" />
        </div>
        <div className="mt-5 overflow-x-auto -mx-2">
          <table className="w-full text-[13px] min-w-[720px]" data-testid="census-table">
            <thead>
              <tr className="label text-left">
                <th className="px-2 py-2">Token</th><th className="px-2">Decimals</th><th className="px-2">Supply</th><th className="px-2">Verdict</th><th className="px-2">Why</th><th className="px-2">Survey</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((r) => (
                <tr key={r.address} className="border-t border-hairline align-top">
                  <td className="px-2 py-2"><div className="font-medium">{r.symbol}</div><Addr a={r.address} /></td>
                  <td className="px-2 py-2 mono">{r.decimals}</td>
                  <td className="px-2 py-2 mono">{whole(r.totalSupply, r.decimals)}</td>
                  <td className="px-2 py-2"><span className={`chip chip-${r.verdict === "invalid" ? "unknown" : r.verdict}`}>{r.verdict === "pass" ? "Passes" : r.verdict === "block" ? "Blocks" : "Unknown"}</span></td>
                  <td className="px-2 py-2 text-ink-2">{[...r.blocks, ...r.unknowns.map((u) => u + "?")].join(", ") || "none"}</td>
                  <td className="px-2 py-2"><Link className="underline underline-offset-4" href={`/survey?token=${r.address}`}>Survey</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>{rows.length.toLocaleString("en-US")} matching of {d.tokens.length.toLocaleString("en-US")} published rows</span>
          {shown < rows.length && <button className="btn btn-ring btn-sm" onClick={() => setShown((n) => n + 200)}>Show more</button>}
        </div>
      </Plate>

      <Plate hover={false}>
        <Label>Heuristic misses, named</Label>
        {d.misses.length ? (
          <ul className="mt-3 grid gap-2 text-[14px]">
            {d.misses.map((m) => (
              <li key={m.address} className="flex flex-wrap gap-3"><Addr a={m.address} /><span className="text-ink-2">{m.note}</span></li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-ink-2">The hand-labelled control set has not been scored yet, so no misses are published. See docs/PROOF.md.</p>
        )}
      </Plate>
    </div>
  );
}
