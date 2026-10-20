"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits, type Address } from "viem";
import ledgerFile from "../../data/ledger.json";
import { LOCK } from "@/lib/deployments";
import { lockLedgerAbi } from "@/lib/abi";
import { elyClient, heClient } from "@/lib/clients";
import { discoverSealed, reconcile, type KeeperRow } from "@/lib/keeper";
import { deploymentsRaw } from "@/lib/deployments";
import { readDecision, type Decision } from "@/lib/chain-read";
import { useTx } from "@/lib/useTx";
import { Addr, Label, Pending, Plate } from "./ui";
import { TxStatus } from "./TxStatus";

type Ledger = typeof ledgerFile & { rows: KeeperRow[] };
const file = ledgerFile as unknown as Ledger;

const STATUS: Record<KeeperRow["status"], { t: string; c: string }> = {
  reconciled: { t: "Books match", c: "var(--ok)" },
  "in-flight": { t: "In flight", c: "var(--signal-amber)" },
  finding: { t: "Needs a decision", c: "var(--signal-red)" },
  abstain: { t: "Not determined", c: "var(--signal-amber)" },
};

function Row({ r }: { r: KeeperRow }) {
  const { address } = useAccount();
  const tx = useTx();
  const [dec, setDec] = useState<Decision | null | undefined>(undefined);
  const s = STATUS[r.status];
  const dp = 18;
  const fmt = (v: string | null) => (v === null ? "n/a" : Number(formatUnits(BigInt(v), dp)).toLocaleString("en-US", { maximumFractionDigits: 4 }));
  const finding = r.findings[0];
  const isAuthority = address && address.toLowerCase() === r.sealedBy.toLowerCase();

  async function load() {
    setDec(await readDecision(r.token as Address));
  }
  async function decide(kind: "acknowledge" | "hold") {
    if (!finding || !LOCK.ledger) return;
    const args = kind === "acknowledge" ? [r.token, finding.hash] : [r.token, finding.hash, "Held from the keeper page"];
    if (await tx.run({ address: LOCK.ledger, abi: lockLedgerAbi as never, functionName: kind, args })) await load();
  }

  return (
    <li className="grid gap-3 py-5 border-t border-hairline first:border-t-0" data-testid="keeper-row" data-status={r.status}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="mono text-[15px]">{r.symbol}</span>
          <Addr a={r.token} />
        </div>
        <span className="chip" style={{ color: s.c }}>{s.t}</span>
      </div>
      <dl className="grid grid-cols-3 gap-4 text-[14px]">
        <div><dt className="label">Escrow</dt><dd className="mono">{fmt(r.escrow)}</dd></div>
        <div><dt className="label">Mirror supply</dt><dd className="mono">{fmt(r.mirrorSupply)}</dd></div>
        <div><dt className="label">Pending</dt><dd className="mono">{fmt(r.pending)}</dd></div>
      </dl>
      <p className="text-[13px] text-muted">{r.pendingNote}</p>
      {finding && (
        <div className="rounded-2xl border border-red px-4 py-3" data-testid="finding">
          <div className="label" style={{ color: "var(--signal-red)" }}>Finding · {finding.kind}</div>
          <p className="mt-1 text-[14px]">{finding.detail}</p>
          <p className="mt-1 mono text-[11px] text-muted break-all">hash {finding.hash}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-ring btn-sm" disabled={!address || !isAuthority} data-testid="acknowledge" onClick={() => decide("acknowledge")}>
              Acknowledge
            </button>
            <button className="btn btn-danger btn-sm" disabled={!address || !isAuthority} data-testid="hold" onClick={() => decide("hold")}>
              Hold crossings
            </button>
            {!isAuthority && <span className="text-[12px] text-muted self-center">Only the sealer or token owner can decide. Connect that wallet.</span>}
          </div>
          <TxStatus state={tx.state} />
        </div>
      )}
      {dec && dec.kind !== 0 && (
        <p className="text-[13px]" data-testid="decision">
          Decision on chain: {dec.kind === 1 ? "acknowledged" : "held"} by <Addr a={dec.by} />{finding && dec.findingHash === finding.hash ? ", bound to this finding." : ". It answers an older finding, so it does not apply to this one."}
        </p>
      )}
    </li>
  );
}

export function KeeperView() {
  const [rows, setRows] = useState<KeeperRow[]>(file.rows);
  const [busy, setBusy] = useState(false);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sweep() {
    if (!LOCK.survey) return;
    setBusy(true);
    setErr(null);
    try {
      const from = BigInt(deploymentsRaw.contracts.LockSurvey.block);
      const toks = await discoverSealed(elyClient, LOCK.survey, from);
      const out: KeeperRow[] = [];
      for (const t of toks) out.push(await reconcile(elyClient, heClient, LOCK.survey, t, from));
      setRows(out);
      setLiveAt(new Date().toISOString());
    } catch (e) {
      setErr((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  const open = rows.reduce((n, r) => n + r.findings.length, 0);

  return (
    <div className="wrap pb-10 grid gap-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Plate hover={false}>
          <Label>Last unattended run</Label>
          <div className="mt-2 text-[22px] font-medium tracking-[-0.02em]" data-testid="last-run">{file.lastRun ? file.lastRun.slice(0, 16).replace("T", " ") + " UTC" : "No run committed yet"}</div>
          <p className="text-[13px] text-muted mt-1">A scheduled GitHub Actions run commits this ledger. Nobody started it.</p>
        </Plate>
        <Plate hover={false}>
          <Label>Sweeps run</Label>
          <div className="display text-[56px] mt-1" data-testid="sweeps">{file.sweeps}</div>
        </Plate>
        <Plate hover={false}>
          <Label>Decisions asked of the builder</Label>
          <div className="display text-[56px] mt-1" data-testid="decisions">{file.decisionsAsked}</div>
          <p className="text-[13px] text-muted">Only for identity drift, books that do not reconcile, or supply growth past the envelope.</p>
        </Plate>
      </div>

      <Plate hover={false}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label>Sealed tokens</Label>
            <p className="text-[14px] text-ink-2 mt-1">{rows.length} tokens, {open} open {open === 1 ? "finding" : "findings"}. {liveAt ? `Live read ${liveAt.slice(11, 19)} UTC.` : "Showing the committed ledger."}</p>
          </div>
          <button className="btn btn-ring" onClick={sweep} disabled={busy || !LOCK.survey} data-testid="sweep-now">
            {busy ? "Reconciling…" : "Reconcile live now"}
          </button>
        </div>
        {err && <p role="alert" className="mt-3 text-red text-[14px]">{err}</p>}
        {rows.length === 0 ? (
          <div className="mt-5">
            <Pending what="No sealed token has been swept yet." how="After the demo tokens are sealed, press Reconcile live now or wait for the next scheduled run." />
          </div>
        ) : (
          <ul className="mt-4">
            {rows.map((r) => (
              <Row key={r.token} r={r} />
            ))}
          </ul>
        )}
      </Plate>
      <p className="text-[13px] text-muted max-w-2xl">
        The books are only equal after finality. Between a lock and its execution on HyperEVM the invariant is escrow = mirror supply + pending, so the keeper counts pending messages first and abstains when it cannot read them.
      </p>
    </div>
  );
}
