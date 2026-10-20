import Link from "next/link";
import { PageHead, Plate, Label } from "@/components/ui";

export const metadata = { title: "For judges · LOCKAGE" };

const WALKS = [
  {
    title: "60 seconds",
    steps: [
      ["Open /survey and press Ines at 23:10", "Two lines go red with the HyperCore rule cited. No wallet needed."],
      ["Press Fixed and locked", "Every line passes. This is the design LOCKAGE would seal."],
      ["Open /proof", "Contracts, every tx hash of the counterfactual, test count, all read from FACTS."],
    ],
  },
  {
    title: "3 minutes",
    steps: [
      ["Connect a wallet on /cross", "Elysium testnet is added if missing. The power icon disconnects."],
      ["Claim 1,000 LSEAL, approve, cross 100", "Pre-flight shows five green checks, then a real LockGate transaction with an explorer link."],
      ["Pick LDRIFT and try to cross", "The call is refused with MirrorIdentityDrift or MetadataDrift, decoded. Send anyway to record the refusal on chain."],
      ["Open /census", "Every Elysium testnet ERC-20, verdicts, filters, and the heuristic's named misses."],
    ],
  },
  {
    title: "10 minutes",
    steps: [
      ["Read contracts/src/LockGate.sol", "One function, nine reverts, one exact-escrow check."],
      ["Compare envelope.ts and LockSurvey.sol", "Both are fed the same 10,000 vectors. forge test fails on any divergence."],
      ["Open /keeper", "The unattended ledger: sweeps run against decisions asked. Acknowledge or Hold is signed by your wallet and bound to the finding hash."],
      ["Open a certificate", "Print it. It is the one page a builder shows holders and Ascend."],
      ["Read docs/DISCOVERY.md", "Every claim is marked VERIFIED with its command, or UNKNOWN."],
    ],
  },
];

export default function Page() {
  return (
    <>
      <PageHead label="For judges" title={<>Three walks. <em>Pick your depth.</em></>} sub="Each step names a page and what you should see. Nothing here needs a token or an account, only a testnet wallet for the signed steps." />
      <div className="wrap grid gap-6 lg:grid-cols-3 pb-10">
        {WALKS.map((w) => (
          <Plate key={w.title} as="section">
            <Label>Walk</Label>
            <h2 className="display text-[40px] mt-1">{w.title}</h2>
            <ol className="mt-5 grid gap-5">
              {w.steps.map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[28px_1fr] gap-3">
                  <span className="mono text-[12px] pt-1 text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="font-medium tracking-[-0.01em]">{t}</div>
                    <p className="text-[14px] text-ink-2 mt-0.5">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Plate>
        ))}
      </div>
      <div className="wrap mt-6 flex flex-wrap gap-4 text-[15px]">
        <Link className="underline underline-offset-4" href="/survey">Survey</Link>
        <Link className="underline underline-offset-4" href="/cross">Cross</Link>
        <Link className="underline underline-offset-4" href="/keeper">Keeper</Link>
        <Link className="underline underline-offset-4" href="/census">Census</Link>
        <Link className="underline underline-offset-4" href="/proof">Proof</Link>
      </div>
    </>
  );
}
