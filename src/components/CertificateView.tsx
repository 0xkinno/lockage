"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { type Address } from "viem";
import { parseAddress, readDecision, readLiveMetaHash, readPair, readSeal, readToken } from "@/lib/chain-read";
import { runSurvey } from "@/lib/survey";
import { Addr, Label, VerdictChip } from "./ui";
import { LogoMark } from "./Logo";

export function CertificateView({ token: raw }: { token: string }) {
  const token = parseAddress(raw);
  const q = useQuery({
    queryKey: ["cert", token],
    enabled: !!token,
    queryFn: async () => {
      const a = token as Address;
      const [info, seal, pair, dec, live] = await Promise.all([readToken(a), readSeal(a), readPair(a), readDecision(a), readLiveMetaHash(a)]);
      return { info, seal, pair, dec, live };
    },
  });

  if (!token) return <div className="wrap pt-40">That is not a token address.</div>;
  if (q.isLoading) return <div className="wrap pt-40" role="status">Reading the chain…</div>;
  if (q.error || !q.data) return <div className="wrap pt-40 text-red" role="alert">Could not read this token: {(q.error as Error)?.message.split("\n")[0]}</div>;

  const { info, seal, pair, dec, live } = q.data;
  const survey = runSurvey({ decimals: info.decimals, supplyBase: info.totalSupply, scan: info.scan });
  const drift = !!seal?.sealed && !!live && live !== seal.metaHash;

  return (
    <div className="wrap pt-32 md:pt-40 pb-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/survey?token=${info.address}`} className="underline underline-offset-4 text-[14px]">Back to the survey</Link>
        <button className="btn btn-primary" onClick={() => window.print()} data-testid="print">Print or save as PDF</button>
      </div>
      <article className="cert mx-auto max-w-[794px] rounded-[24px] border border-hairline bg-paper-2 p-6 md:p-12" style={{ boxShadow: "var(--lime-glow)" }} data-testid="certificate">
        <header className="flex items-start justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <Label>Lock Certificate</Label>
            <h1 className="display text-[44px] md:text-[64px] mt-2">{info.name}</h1>
            <div className="mono text-[13px] text-ink-2">{info.symbol} · {info.decimals} decimals</div>
          </div>
          <LogoMark size={44} />
        </header>

        <section className="grid gap-4 md:grid-cols-2 py-6 border-b border-hairline text-[14px]">
          <div><div className="label">Token</div><Addr a={info.address} full /></div>
          <div><div className="label">Canonical mirror (HyperEVM)</div><Addr a={pair.mirror} chain="hyperevm" full /></div>
          <div><div className="label">Seal</div>
            {seal?.sealed ? <span data-testid="seal-state">Sealed {new Date(seal.sealedAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC by <Addr a={seal.sealedBy} /></span> : <span data-testid="seal-state">Not sealed yet</span>}
          </div>
          <div><div className="label">Identity</div>
            <span className="font-medium" style={{ color: drift ? "var(--signal-red)" : "var(--ok)" }}>{!seal?.sealed ? "Nothing to compare" : drift ? "Drifted since the seal" : "Matches the seal"}</span>
          </div>
          <div className="md:col-span-2"><div className="label">Metadata hash sealed</div><span className="mono text-[12px] break-all">{seal?.sealed ? seal.metaHash : "none"}</span></div>
        </section>

        <section className="py-6 border-b border-hairline">
          <Label>Graduation envelope</Label>
          {survey.env.graduates ? (
            <dl className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-[14px]">
              <div><dt className="label">weiDecimals</dt><dd className="display text-[36px]">{survey.env.bestWei}</dd></div>
              <div><dt className="label">szDecimals up to</dt><dd className="display text-[36px]">{survey.env.maxSz}</dd></div>
              <div><dt className="label">evmExtraWei</dt><dd className="display text-[36px]">{survey.env.evmExtra}</dd></div>
              <div><dt className="label">Deposit multiple</dt><dd className="mono text-[15px] pt-3">{survey.env.alignUnit.toLocaleString("en-US")}</dd></div>
            </dl>
          ) : (
            <p className="mt-2 text-red">This token cannot graduate to HyperCore at any allowed granularity.</p>
          )}
        </section>

        <section className="py-6 border-b border-hairline">
          <Label>The five lines</Label>
          <ul className="mt-3 grid gap-3">
            {survey.lines.map((l) => (
              <li key={l.id} className="grid gap-1 md:grid-cols-[180px_1fr_auto] md:items-start md:gap-4 text-[14px]">
                <span className="font-medium">{l.title}</span>
                <span className="text-ink-2">{l.detail}</span>
                <VerdictChip v={l.verdict} />
              </li>
            ))}
          </ul>
        </section>

        <footer className="pt-6 text-[13px] text-ink-2 grid gap-1">
          <div>Keeper decision: {dec && dec.kind !== 0 ? `${dec.kind === 1 ? "acknowledged" : "held"} by ${dec.by}` : "none recorded"}</div>
          <div className="label">Testnet certificate · Elysium 99801 · issued by LOCKAGE, authored by 0xkinno</div>
        </footer>
      </article>
    </div>
  );
}
