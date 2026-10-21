import { cachedSurvey, type SurveyResponse } from "@/lib/survey-api";
import { CheckArtifact, type CheckKind } from "@/components/art";

export const dynamic = "force-dynamic";
export const metadata = { title: "LOCKAGE embed" };

const KINDS: CheckKind[] = ["supply", "decimals", "metadata", "growth", "transfer"];
const COLOR = { pass: "var(--ok)", block: "var(--signal-red)", unknown: "var(--signal-amber)" } as const;
const WORD = { pass: "Passes", block: "Blocks graduation", unknown: "Not determined" } as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v !== undefined) params.set(k, v);
  const hasInput = params.has("address") || params.has("decimals");
  const { body } = hasInput ? await cachedSurvey(params) : { body: null };
  const r = body && body.ok ? (body as SurveyResponse) : null;

  return (
    <div className="embed-root" data-testid="embed" style={{ width: 360, maxWidth: "100%", margin: "0 auto", padding: 12 }}>
      <style>{"header,footer,.no-embed{display:none!important}body::before{display:none}main{padding:0!important}"}</style>
      <div className="plate !p-4" style={{ background: "var(--paper-2)" }}>
        <div className="label">LOCKAGE · before you launch</div>
        {!hasInput && <p className="mt-2 text-[14px] text-ink-2">Pass <span className="mono">?address=0x...</span> or <span className="mono">?decimals=18&amp;supply=1000000000000&amp;rename=1</span>.</p>}
        {hasInput && !r && body && !body.ok && <p role="alert" className="mt-2 text-[14px] text-red">{body.error}</p>}
        {r && (
          <>
            <div className="mt-1 display text-[26px] leading-[1.05]" style={{ color: COLOR[r.overall] }} data-testid="embed-headline">
              {r.overall === "pass" ? "Can graduate as it stands." : r.overall === "block" ? `${r.blocks} ${r.blocks === 1 ? "line blocks" : "lines block"} graduation.` : "Not fully determined."}
            </div>
            {r.token && <div className="mt-1 mono text-[11px] text-muted">{r.token.symbol} · {r.token.decimals} decimals</div>}
            <ul className="mt-3 grid gap-2">
              {r.lines.map((l, i) => (
                <li key={l.id} className="rounded-xl border border-hairline bg-paper px-3 py-2" data-line={l.id} data-verdict={l.verdict}>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 34, height: 22, flex: "none" }}><CheckArtifact kind={KINDS[i]} /></span>
                    <span className="text-[13px] font-medium flex-1">{l.title}</span>
                    <span className="mono text-[10px] uppercase" style={{ color: COLOR[l.verdict as keyof typeof COLOR] }}>{WORD[l.verdict as keyof typeof WORD]}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-2">{l.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">
              {r.rpc ? `Read from ${r.rpc.chain} via ${r.rpc.answeredBy}. ` : "Computed from the numbers entered. "}
              <a className="underline" href="https://lockage-kinnoskis-projects.vercel.app/survey" target="_blank" rel="noreferrer">Open the full survey</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
