import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { facts, pct } from "@/lib/facts";
import { Arrow, Label, LinkBtn, Pending, Plate, Reveal, SectionHead, TxLink } from "@/components/ui";
import { CheckArtifact, CrossingScene, HeroPlate, LadderDesktop, LadderMobile, type CheckKind } from "@/components/art";

const CHECKS: { kind: CheckKind; title: string; line: string; rule: string }[] = [
  { kind: "supply", title: "Supply fit", line: "Can the whole supply sit under HyperCore's 64-bit Core ceiling at any granularity?", rule: "Core amounts are uint64 in Core wei" },
  { kind: "decimals", title: "Decimals plan", line: "Which weiDecimals will you be forced into, and which deposits will revert unaligned?", rule: "szDecimals + 5 <= weiDecimals" },
  { kind: "metadata", title: "Metadata identity", line: "Can the name or symbol change? A rename moves the canonical mirror to a new address.", rule: "Mirror = token + exact live metadata" },
  { kind: "growth", title: "Supply growth", line: "Can anyone mint after launch? Genesis supply must back every possible unit.", rule: "Escrow must cover genesis supply" },
  { kind: "transfer", title: "Transfer behaviour", line: "Does what you send arrive exactly? Taxes and rebases cannot cross.", rule: "Fee-on-transfer is unsupported" },
];

export default function Home() {
  const hasPhoto = existsSync(join(process.cwd(), "public", "hero.png"));
  const c = facts.census;
  const asIs = c ? pct(c.canGraduateAsIs, c.surveyed) : null;
  const cf = facts.counterfactual as null | { baseline?: { txHash?: string; status?: string }; control?: { txHash?: string }; intervention?: { txHash?: string; error?: string }; ranOn?: string };

  return (
    <>
      {/* 1. HERO */}
      <section className="pt-28 md:pt-36" aria-labelledby="hero-title">
        <div className="wrap grid gap-8 lg:gap-12 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center order-2 lg:order-1 py-2 lg:py-10">
            <Reveal>
              <Label>For builders launching on Ascend</Label>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 id="hero-title" className="display mt-5 text-[46px] leading-[1] sm:text-[64px] lg:text-[88px] lg:leading-[0.96]">
                Your token&apos;s future is decided <em>tonight</em>.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 text-[18px] md:text-[20px] leading-[1.5] text-ink-2 max-w-xl">
                LOCKAGE reads the five things HyperCore will hold you to, before you press launch, and walks your holders across only on the route that is still real.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <LinkBtn href="/survey">
                  Survey a token <Arrow />
                </LinkBtn>
                <Link href="/cross" className="text-[16px] font-medium underline decoration-lime-deep decoration-2 underline-offset-[6px] hover:decoration-ink">
                  See a live crossing, no wallet
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-10 pt-5 border-t border-hairline mono text-[12px] tracking-[0.06em] uppercase text-ink-2" data-testid="census-strip">
                {c ? (
                  <>
                    Census {c.ranOn} · {c.surveyed.toLocaleString("en-US")} tokens · {asIs} can graduate as-is
                  </>
                ) : (
                  <>Census run pending · numbers appear here from FACTS only</>
                )}
              </div>
            </Reveal>
          </div>
          <div className="lg:col-span-5 order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-[28px] border border-hairline h-[230px] sm:h-[300px] lg:h-full lg:min-h-[560px]" data-testid="hero-plate">
              {hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/hero.png" alt="Stone canal locks climbing a hillside at dawn, a small vessel rising in the third chamber" fetchPriority="high" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "63% 42%" }} />
              ) : (
                <HeroPlate />
              )}
              <div className="absolute left-4 bottom-4 chip chip-pass bg-paper/80 backdrop-blur" style={{ color: "var(--ink)" }}>
                Testnet 99801
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LADDER */}
      <section className="mt-28 md:mt-40" aria-labelledby="ladder-title">
        <div className="wrap">
          <Reveal>
            <SectionHead label="The ladder" title={<span id="ladder-title">Four rungs. The third decides the rest.</span>} sub="Ascend sells every project the same climb. The third rung is a one-shot ceremony whose parameters are permanent, and it is gated by facts you fixed at launch." />
          </Reveal>
          <div className="mt-12">
            <LadderDesktop />
            <LadderMobile />
          </div>
        </div>
      </section>

      {/* 3. INES */}
      <section className="mt-28 md:mt-40 bg-paper-2 border-y border-hairline" aria-labelledby="ines-title">
        <div className="wrap py-16 md:py-24 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <Label>Ines&apos;s night · fictional persona</Label>
              <div className="mono mt-6 text-[64px] md:text-[96px] leading-none tracking-[-0.04em]" aria-label="Twenty three ten">
                23:10
              </div>
              <div className="label mt-3">Porto · launch night</div>
            </Reveal>
          </div>
          <div className="lg:col-span-7 grid gap-6 text-[18px] leading-[1.6] text-ink-2 max-w-2xl">
            <Reveal>
              <h2 id="ines-title" className="display text-[36px] md:text-[48px] text-ink">
                She types a trillion because big supplies look cheap.
              </h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p>
                Ines is launching her first token on Ascend. The form asks for a name, a symbol and a supply. Her template lets the owner rename the token later, in case of a rebrand. The launch transaction is irreversible.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <p>
                Four months on, her token qualifies for HyperCore. In one evening she learns that her supply does not fit the 64-bit ceiling at the granularity she wanted, that her rebrand moved the canonical mirror to a new address, and that her owner mint means the genesis supply cannot back every possible unit.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="text-ink">None of it is a bug. It is all in the docs, on three pages, written for issuers who already know to look. Nobody told her at the only moment it was cheap to fix.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4. FIVE CHECKS */}
      <section className="mt-28 md:mt-40" aria-labelledby="checks-title">
        <div className="wrap">
          <Reveal>
            <SectionHead label="The five checks" title={<span id="checks-title">Five lines. Each one cites its rule.</span>} sub="Each line says Passes, Blocks graduation, or Not determined. When a property cannot be read, LOCKAGE says so and never prints a green verdict over it." />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {CHECKS.map((k, i) => (
              <Reveal key={k.kind} delay={i * 0.06} className={i < 3 ? "lg:col-span-2" : "lg:col-span-3"}>
                <Plate className="h-full" as="article">
                  <div className="rounded-[14px] bg-paper border border-hairline px-4 py-3 h-[150px] grid place-items-center">
                    <CheckArtifact kind={k.kind} />
                  </div>
                  <div className="label mt-5">{String(i + 1).padStart(2, "0")} · {k.rule}</div>
                  <h3 className="mt-2 text-[24px] font-medium tracking-[-0.03em]">{k.title}</h3>
                  <p className="mt-2 text-[16px] text-ink-2">{k.line}</p>
                </Plate>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CROSSING */}
      <section className="mt-28 md:mt-40" aria-labelledby="cross-title">
        <div className="wrap grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <Label>The crossing</Label>
              <h2 id="cross-title" className="display mt-3 text-[40px] md:text-[56px]">
                Holders cross only on the route that is still <em>real</em>.
              </h2>
              <p className="mt-5 text-[18px] text-ink-2 max-w-md">
                A crossing through LockGate lands on the mirror the token was sealed with, through a registered route, with exact escrow, or it reverts before any funds move.
              </p>
              <div className="mt-7">
                <LinkBtn href="/cross" variant="ring">
                  Try a crossing <Arrow />
                </LinkBtn>
              </div>
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Plate hover={false} className="!p-4 md:!p-6">
              <CrossingScene />
            </Plate>
          </div>
        </div>
      </section>

      {/* 6. PROOF */}
      <section className="mt-28 md:mt-40" aria-labelledby="proof-title">
        <div className="wrap">
          <Reveal>
            <SectionHead label="Proof" title={<span id="proof-title">Measured on chain, published as found.</span>} sub="Every number here is read from docs/FACTS.json, written by a script from real runs. Nothing is typed by hand." />
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <Reveal>
              <Plate className="h-full">
                <Label>Census</Label>
                {c ? (
                  <>
                    <div className="display text-[64px] mt-3">{asIs}</div>
                    <p className="text-ink-2">of {c.surveyed.toLocaleString("en-US")} Elysium testnet tokens can graduate as-is. {c.mutableMetadata.toLocaleString("en-US")} have mutable metadata, {c.mintable.toLocaleString("en-US")} can mint.</p>
                    <Link href="/census" className="mt-4 inline-block underline underline-offset-4">
                      Open the census
                    </Link>
                  </>
                ) : (
                  <Pending what="The census has not run yet." how="It scans every ERC-20 on Elysium testnet and publishes the counts and the heuristic's misses." />
                )}
              </Plate>
            </Reveal>
            <Reveal delay={0.06}>
              <Plate className="h-full">
                <Label>Counterfactual</Label>
                {cf?.intervention?.txHash ? (
                  <ul className="mt-3 grid gap-3 text-[16px]">
                    <li className="flex items-center justify-between gap-3 border-b border-hairline pb-3">
                      <span>Raw route, after rename</span>
                      <span className="flex items-center gap-2">
                        <span className="chip chip-block">Accepted</span>
                        {cf.baseline?.txHash && <TxLink hash={cf.baseline.txHash} />}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-3">
                      <span>LOCKAGE, after rename</span>
                      <span className="flex items-center gap-2">
                        <span className="chip chip-pass">Refused</span>
                        <TxLink hash={cf.intervention.txHash} />
                      </span>
                    </li>
                  </ul>
                ) : (
                  <Pending what="The drift reproduction has not run yet." how="It deploys a renameable token, crosses it on the raw route, renames it, then tries both routes again and records every tx hash." />
                )}
              </Plate>
            </Reveal>
            <Reveal delay={0.12}>
              <Plate className="h-full">
                <Label>Tests</Label>
                {facts.tests ? (
                  <>
                    <div className="display text-[64px] mt-3">{facts.tests.total}</div>
                    <p className="text-ink-2">
                      Foundry tests, {facts.tests.passed} passing, fuzzed at {facts.tests.fuzzRunsPerProperty.toLocaleString("en-US")} runs. The Solidity and TypeScript envelopes agree on {facts.tests.twinVectors?.toLocaleString("en-US")} vectors.
                    </p>
                    <Link href="/proof" className="mt-4 inline-block underline underline-offset-4">
                      Open the proof page
                    </Link>
                  </>
                ) : (
                  <Pending what="Test count not generated yet." how="Run npm run facts." />
                )}
              </Plate>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 7. FOR ASCEND */}
      <section className="mt-28 md:mt-40 border-t border-hairline pt-16 md:pt-24" aria-labelledby="ascend-title">
        <div className="wrap grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <Label>For Ascend</Label>
              <h2 id="ascend-title" className="display mt-3 text-[40px] md:text-[56px]">
                <span className="mono text-[0.7em] tracking-[-0.04em]">$LOCK</span> climbs its own ladder.
              </h2>
              <p className="mt-5 text-[18px] text-ink-2 max-w-md">LOCKAGE surveys and seals its own token first, publishes the certificate, and graduates through its own rail.</p>
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <ol className="grid gap-0 border-t border-hairline">
              {[
                ["Mainnet redeploy", "At Elysium mainnet launch, with the same contracts and a public seal for $LOCK."],
                ["Deposit-wallet leg", "When Kinetiq publishes the factory, LockGate extends from HyperEVM into HyperCore deposits with alignment pre-checks."],
                ["HyperCore read precompile", "Reconcile Core supply against deposit-wallet escrow on-chain, with no relay."],
                ["Inside the launch form", "An embeddable pre-launch check for Ascend, so a builder reads the envelope before she presses launch."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[48px_1fr] gap-4 py-5 border-b border-hairline">
                  <span className="label pt-1.5">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="text-[20px] font-medium tracking-[-0.02em]">{t}</div>
                    <p className="text-ink-2 mt-1">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-4">
              <LinkBtn href="/judge">Walk it in 60 seconds</LinkBtn>
              <LinkBtn href="/proof" variant="ring">
                Read the proof
              </LinkBtn>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
