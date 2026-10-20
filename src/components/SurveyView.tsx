"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import { parseUnits, type Address } from "viem";
import { runSurvey, type Survey } from "@/lib/survey";
import { maxWholeSupply } from "@/lib/envelope";
import { NotAnErc20, parseAddress, readSeal, readToken, type SealInfo, type TokenInfo } from "@/lib/chain-read";
import { DEMOS, LOCK } from "@/lib/deployments";
import { erc20Abi, lockProbeAbi, lockSurveyAbi } from "@/lib/abi";
import { elysiumTestnet } from "@/lib/chains";
import { useTx } from "@/lib/useTx";
import { Addr, Label, Plate, VerdictChip } from "./ui";
import { CheckArtifact } from "./art";
import { TxStatus } from "./TxStatus";

const KINDS = ["supply", "decimals", "metadata", "growth", "transfer"] as const;

function parseWhole(s: string): bigint | null {
  const t = s.replace(/[,\s_]/g, "");
  if (!/^\d{1,40}$/.test(t)) return null;
  return BigInt(t);
}

function Verdicts({ s }: { s: Survey }) {
  const head =
    s.overall === "pass"
      ? { t: "This token can graduate as it stands.", c: "var(--ok)" }
      : s.overall === "block"
        ? { t: `${s.blocks} ${s.blocks === 1 ? "line blocks" : "lines block"} graduation.`, c: "var(--signal-red)" }
        : { t: "Nothing blocks, but not everything could be determined.", c: "var(--signal-amber)" };
  return (
    <div data-testid="survey-result" data-overall={s.overall}>
      <div className="display text-[34px] md:text-[44px]" style={{ color: head.c }} data-testid="survey-headline">
        {head.t}
      </div>
      <ul className="mt-6 grid gap-3">
        {s.lines.map((l, i) => (
          <li key={l.id}>
            <Plate hover as="article" className="!p-4 md:!p-5">
              <div className="grid gap-4 md:grid-cols-[120px_1fr] items-start" data-line={l.id} data-verdict={l.verdict}>
                <div className="hidden md:block h-[72px]">
                  <CheckArtifact kind={KINDS[i]} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <h3 className="text-[20px] font-medium tracking-[-0.02em]">
                      <span className="label mr-3">{String(i + 1).padStart(2, "0")}</span>
                      {l.title}
                    </h3>
                    <VerdictChip v={l.verdict} />
                  </div>
                  <p className="mt-2 text-ink-2">{l.detail}</p>
                  <p className="mt-2 label">Rule · {l.rule}</p>
                  {l.fix && <p className="mt-2 text-[14px]">{l.verdict === "unknown" ? "What would determine it: " : "Fix: "}{l.fix}</p>}
                </div>
              </div>
            </Plate>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Toggle({ label, hint, on, set, id }: { label: string; hint: string; on: boolean; set: (v: boolean) => void; id: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} data-testid={`toggle-${id}`} onClick={() => set(!on)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-hairline bg-paper px-4 py-3 text-left hover:shadow-[var(--lime-glow)] transition">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <span className="relative inline-block h-6 w-11 shrink-0 rounded-full border border-ink" style={{ background: on ? "var(--lime)" : "transparent" }}>
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all" style={{ left: on ? 22 : 3 }} />
      </span>
    </button>
  );
}

function DesignMode() {
  const [dec, setDec] = useState("18");
  const [sup, setSup] = useState("1,000,000,000,000");
  const [rename, setRename] = useState(true);
  const [mint, setMint] = useState(false);
  const [tax, setTax] = useState(false);

  const d = /^\d{1,3}$/.test(dec) ? Number(dec) : null;
  const whole = parseWhole(sup);
  const survey = useMemo(() => (d !== null && whole !== null && d <= 255 ? runSurvey({ decimals: d, supplyBase: whole * 10n ** BigInt(d), design: { rename, mint, tax } }) : null), [d, whole, rename, mint, tax]);

  const preset = (decimals: string, supply: string, r: boolean, m: boolean, t: boolean) => {
    setDec(decimals);
    setSup(supply);
    setRename(r);
    setMint(m);
    setTax(t);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <Plate hover={false} className="self-start">
        <Label>Your launch form</Label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-ring btn-sm" data-testid="preset-ines" onClick={() => preset("18", "1,000,000,000,000", true, true, false)}>
            Ines at 23:10
          </button>
          <button className="btn btn-ring btn-sm" data-testid="preset-fixed" onClick={() => preset("18", "1,000,000,000", false, false, false)}>
            Fixed and locked
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="label">Decimals</span>
            <input className="field" inputMode="numeric" value={dec} onChange={(e) => setDec(e.target.value)} aria-label="Decimals" data-testid="in-decimals" />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Total supply, whole tokens</span>
            <input className="field" inputMode="numeric" value={sup} onChange={(e) => setSup(e.target.value)} aria-label="Total supply" data-testid="in-supply" />
            {d !== null && d <= 255 && <span className="text-[12px] text-muted">Most you can launch at {d} decimals and still graduate: {maxWholeSupply(d).toLocaleString("en-US")}</span>}
          </label>
          <Toggle id="rename" label="Owner can rename" hint="setName or setSymbol exists" on={rename} set={setRename} />
          <Toggle id="mint" label="Owner can mint" hint="supply can grow after launch" on={mint} set={setMint} />
          <Toggle id="tax" label="Transfer tax" hint="a fee is taken on every move" on={tax} set={setTax} />
        </div>
      </Plate>
      <div>
        {survey ? <Verdicts s={survey} /> : <p className="text-ink-2" role="status">Enter decimals from 0 to 255 and a whole-number supply.</p>}
      </div>
    </div>
  );
}

function AddressMode() {
  const params = useSearchParams();
  const { address: me } = useAccount();
  const ely = usePublicClient({ chainId: elysiumTestnet.id });
  const [input, setInput] = useState(params.get("token") ?? DEMOS[1].address ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [seal, setSeal] = useState<SealInfo | null>(null);
  const [probe, setProbe] = useState<{ exact: boolean; received: bigint; sent: bigint } | null>(null);
  const sealTx = useTx();
  const probeTx = useTx();

  async function go(raw = input) {
    const a = parseAddress(raw);
    setErr(null);
    setInfo(null);
    setSeal(null);
    setProbe(null);
    if (!a) return setErr("That is not a valid address.");
    setBusy(true);
    try {
      const t = await readToken(a);
      setInfo(t);
      setSeal(await readSeal(a).catch(() => null));
    } catch (e) {
      setErr(e instanceof NotAnErc20 ? e.message : "Could not read this token: " + (e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get("token")) void go(params.get("token")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const survey = useMemo(() => (info ? runSurvey({ decimals: info.decimals, supplyBase: info.totalSupply, scan: info.scan, probe: probe ? { exact: probe.exact } : null }) : null), [info, probe]);

  async function doSeal() {
    if (!info || !LOCK.survey) return;
    const h = await sealTx.run({ address: LOCK.survey, abi: lockSurveyAbi as never, functionName: "seal", args: [info.address] });
    if (h) setSeal(await readSeal(info.address));
  }

  async function doProbe() {
    if (!info || !LOCK.probe || !me || !ely) return;
    const amount = 10n ** BigInt(Math.max(info.decimals - 2, 0)) || 1n;
    const allowance = await ely.readContract({ address: info.address, abi: erc20Abi, functionName: "allowance", args: [me, LOCK.probe] });
    if (allowance < amount) {
      const h = await probeTx.run({ address: info.address, abi: erc20Abi as never, functionName: "approve", args: [LOCK.probe, amount] });
      if (!h) return;
    }
    try {
      const sim = await ely.simulateContract({ account: me, address: LOCK.probe, abi: lockProbeAbi, functionName: "probe", args: [info.address, amount] });
      const [received, , exact] = sim.result;
      setProbe({ exact, received, sent: amount });
    } catch (e) {
      setErr("Probe could not run: " + (e as Error).message.split("\n")[0]);
      return;
    }
    await probeTx.run({ address: LOCK.probe, abi: lockProbeAbi as never, functionName: "probe", args: [info.address, amount] });
  }

  return (
    <div className="grid gap-8">
      <Plate hover={false}>
        <Label>Paste an Elysium testnet token</Label>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
        >
          <input className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x…" aria-label="Token address" data-testid="in-address" spellCheck={false} />
          <button className="btn btn-primary shrink-0" disabled={busy} data-testid="run-survey">
            {busy ? "Reading chain…" : "Survey"}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {DEMOS.filter((d) => d.address).map((d) => (
            <button
              key={d.key}
              className="btn btn-ring btn-sm"
              onClick={() => {
                setInput(d.address!);
                void go(d.address!);
              }}
            >
              {d.symbol} · {d.line}
            </button>
          ))}
        </div>
        {err && (
          <p role="alert" className="mt-4 text-red text-[14px]">
            {err}
          </p>
        )}
      </Plate>

      {info && survey && (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Label>Surveyed</Label>
              <div className="display text-[40px]">
                {info.name} <span className="mono text-[0.5em] text-muted">{info.symbol}</span>
              </div>
              <div className="text-[14px] text-ink-2">
                <Addr a={info.address} full /> · {info.decimals} decimals · supply {(info.totalSupply / 10n ** BigInt(info.decimals)).toLocaleString("en-US")}
                {info.proxyImpl && <> · proxy to <Addr a={info.proxyImpl} /></>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {LOCK.probe && (
                <button className="btn btn-ring" onClick={doProbe} disabled={!me} data-testid="run-probe" title={me ? "Measures a round trip on chain" : "Connect a wallet to probe"}>
                  Run on-chain probe
                </button>
              )}
              {LOCK.survey ? (
                <button className="btn btn-primary" onClick={doSeal} disabled={!me} data-testid="seal" title={me ? "" : "Connect a wallet to seal"}>
                  {seal?.sealed ? "Re-seal" : "Seal on chain"}
                </button>
              ) : (
                <span className="label self-center">Contracts not deployed yet</span>
              )}
            </div>
          </div>
          <TxStatus state={sealTx.state} />
          <TxStatus state={probeTx.state} />
          {probe && (
            <p className="text-[14px]" data-testid="probe-result">
              Probe sent {probe.sent.toString()} base units and {probe.exact ? "got exactly that back." : `received ${probe.received.toString()}. Amounts change on transfer.`}
            </p>
          )}
          {seal?.sealed && (
            <Plate hover={false} className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[14px]">
                  Sealed {new Date(seal.sealedAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC by <Addr a={seal.sealedBy} />. Mirror <Addr a={seal.mirror} chain="hyperevm" />.
                </div>
                <Link href={`/certificate/${info.address}`} className="btn btn-ring btn-sm" data-testid="open-certificate">
                  Open certificate
                </Link>
              </div>
            </Plate>
          )}
          <Verdicts s={survey} />
        </div>
      )}
    </div>
  );
}

export function SurveyView() {
  const [mode, setMode] = useState<"design" | "address">("design");
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("token")) setMode("address");
  }, [params]);
  return (
    <div className="wrap pb-10">
      <div role="tablist" aria-label="Survey mode" className="inline-flex rounded-full border border-hairline bg-paper-2 p-1 mb-8">
        {(
          [
            ["design", "Design a token"],
            ["address", "Survey an address"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={mode === k} data-testid={`tab-${k}`} onClick={() => setMode(k)} className="px-5 h-10 rounded-full text-[14px] font-medium" style={mode === k ? { background: "var(--ink)", color: "var(--paper)" } : { color: "var(--ink-2)" }}>
            {label}
          </button>
        ))}
      </div>
      {mode === "design" ? <DesignMode /> : <AddressMode />}
    </div>
  );
}

export type { Address };
export { parseUnits };
