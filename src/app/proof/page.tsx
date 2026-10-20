import { PageHead, Label, Plate, Pending, Addr, TxLink } from "@/components/ui";
import { facts } from "@/lib/facts";
import { deploymentsRaw } from "@/lib/deployments";
import { ADDR } from "@/lib/chains";
import { formatEther } from "viem";
export const metadata = { title: "Proof · LOCKAGE" };
type Step = { step: string; txHash?: string; chain?: "elysium" | "hyperevm"; status?: string; note?: string; error?: string };
type Exp = { ranOn?: string; file?: string; steps?: Step[]; outcomes?: Record<string, string>; baseline?: Step; control?: Step; intervention?: Step };
export default function Page() {
  const contracts = Object.entries(deploymentsRaw.contracts);
  const drift = facts.drift as Exp | null;
  const cf = facts.counterfactual as Exp | null;
  const steps = [
    cf?.baseline && { s: cf.baseline, label: cf.baseline.status === "accepted" ? "Accepted" : "Refused", good: cf.baseline.status !== "accepted" },
    cf?.control && { s: cf.control, label: cf.control.status === "accepted" ? "Accepted" : "Refused", good: cf.control.status === "accepted" },
    cf?.intervention && { s: cf.intervention, label: cf.intervention.status === "reverted" ? "Refused" : "Accepted", good: cf.intervention.status === "reverted" },
  ].filter(Boolean) as { s: Step; label: string; good: boolean }[];
  const fee = (w: string) => Number(formatEther(BigInt(w))).toFixed(5);
  return (
    <>
      <PageHead label="Proof" title={<>Every number is read from <em>FACTS</em>.</>} sub="Contracts, every transaction hash of the counterfactual, test counts, measured costs and dated runs. If a run has not happened, the page says so." />
      <div className="wrap pb-10 grid gap-8 grid-cols-[minmax(0,1fr)]">
        <Plate hover={false}>
          <Label>Contracts on Elysium testnet</Label>
          {contracts.length ? (
            <div className="mt-4 overflow-x-auto"><table className="w-full text-[14px]" data-testid="contracts-table">
              <thead>
                <tr className="label text-left"><th className="py-2">Contract</th><th>Address</th><th className="hidden sm:table-cell">Deploy tx</th><th className="hidden md:table-cell">Gas</th><th className="hidden md:table-cell">Fee (HYPE)</th></tr>
              </thead>
              <tbody>
                {contracts.map(([n, c]) => (
                  <tr key={n} className="border-t border-hairline">
                    <td className="py-2 font-medium">{n}</td>
                    <td><Addr a={c.address} /></td>
                    <td className="hidden sm:table-cell"><TxLink hash={c.txHash} /></td>
                    <td className="hidden md:table-cell mono">{Number(c.gasUsed).toLocaleString("en-US")}</td>
                    <td className="hidden md:table-cell mono">{fee(c.feeWei)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : (
            <div className="mt-4"><Pending what="Contracts are not deployed yet." how="Fund the deployer wallet and run npm run deploy." /></div>
          )}
        </Plate>
        <div className="grid gap-6 lg:grid-cols-2 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
          <Plate hover={false}>
            <Label>Counterfactual</Label>
            {steps.length ? (
              <ul className="mt-4 grid gap-3 text-[15px]">
                {steps.map(({ s, label, good }) => (
                  <li key={s.step} className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 last:border-0">
                    <span>{s.step}{s.error ? <span className="mono text-[12px] text-red"> · {s.error}</span> : null}</span>
                    <span className="flex items-center gap-2">
                      <span className={`chip ${good ? "chip-pass" : "chip-block"}`}>{label}</span>
                      {s.txHash && <TxLink hash={s.txHash} chain={s.chain} />}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4"><Pending what="The counterfactual has not run." how="npm run experiment:drift records baseline, control and intervention with every tx hash." /></div>
            )}
          </Plate>
          <Plate hover={false}>
            <Label>Drift reproduction (D1)</Label>
            {drift?.outcomes ? (
              <dl className="mt-4 grid gap-3 text-[14px]" data-testid="d1-outcomes">
                {Object.entries(drift.outcomes).map(([k, v]) => (
                  <div key={k}><dt className="label">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            ) : (
              <div className="mt-4"><Pending what="D1 outcomes will appear here." how="They are answered by experiment on testnet, never by reading the docs." /></div>
            )}
          </Plate>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Plate hover={false}>
            <Label>Tests</Label>
            <div className="display text-[56px] mt-1">{facts.tests?.total ?? "n/a"}</div>
            <p className="text-[14px] text-ink-2">{facts.tests ? `${facts.tests.passed} pass, ${facts.tests.failed} fail. Fuzz ${facts.tests.fuzzRunsPerProperty.toLocaleString("en-US")} runs. Twin vectors ${facts.tests.twinVectors?.toLocaleString("en-US")}.` : "Run npm run facts."}</p>
          </Plate>
          <Plate hover={false}>
            <Label>Challenge window</Label>
            <div className="display text-[56px] mt-1">{facts.challengeWindowSeconds ? `${Math.round(facts.challengeWindowSeconds / 60)} min` : "n/a"}</div>
            <p className="text-[14px] text-ink-2">{facts.challengeWindowSeconds ? "Measured from a real crossing." : "Not measured yet. It needs one real crossing."}</p>
          </Plate>
          <Plate hover={false}>
            <Label>Facts generated</Label>
            <div className="text-[20px] font-medium mt-3">{facts.generatedAt.slice(0, 16).replace("T", " ")} UTC</div>
            <p className="text-[14px] text-ink-2 mt-1">docs/FACTS.json is written by scripts/facts.ts.</p>
          </Plate>
        </div>
        <Plate hover={false}>
          <Label>Elysium surfaces used</Label>
          <ul className="mt-3 grid gap-1 text-[14px] text-ink-2">
            <li>Bridge factory <Addr a={ADDR.elysium.bridgeFactory} />: expectedL1Mirror, l2WalletFor</li>
            <li>Gateway router <Addr a={ADDR.elysium.router} />: getGateway, outboundTransfer</li>
            <li>Bridge-wallet gateway <Addr a={ADDR.elysium.walletGateway} />: the only route LockGate accepts</li>
            <li>Mirror factory <Addr a={ADDR.hyperevm.mirrorFactory} chain="hyperevm" />: mirror registration</li>
            <li>ArbSys <Addr a={ADDR.elysium.arbSys} /> and Outbox <Addr a={ADDR.hyperevm.outbox} chain="hyperevm" />: pending message accounting</li>
          </ul>
        </Plate>
      </div>
    </>
  );
}
