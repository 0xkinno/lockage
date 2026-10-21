"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits, type Address } from "viem";
import { DEMOS, LOCK, type DemoToken } from "@/lib/deployments";
import { balanceOf, preflightChecks, readPair, readSeal, readToken } from "@/lib/chain-read";
import { driftTokenAbi, erc20Abi, lockGateAbi, routerAbi } from "@/lib/abi";
import { ADDR } from "@/lib/chains";
import { heClient, elyClient } from "@/lib/clients";
import { facts } from "@/lib/facts";
import { useTx } from "@/lib/useTx";
import { Addr, Label, Pending, Plate, TxLink } from "./ui";
import { TxStatus } from "./TxStatus";

const codeNames: Record<number, string> = { 0: "pass", 1: "NotSealed", 2: "OnHold", 3: "MetadataDrift", 4: "MirrorIdentityDrift", 5: "EnvelopeBroken", 6: "PairNotDeployed", 7: "RouteNotRegistered" };

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[40px_1fr] gap-4 py-6 border-t border-hairline first:border-t-0">
      <div className="mono grid place-items-center w-9 h-9 rounded-full border border-ink text-[13px]" style={done ? { background: "var(--lime)", boxShadow: "var(--lime-glow)" } : undefined}>
        {done ? "✓" : n}
      </div>
      <div>
        <h3 className="text-[22px] font-medium tracking-[-0.03em]">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

export function CrossView() {
  const { address: me } = useAccount();
  const qc = useQueryClient();
  const live = DEMOS.filter((d) => d.address && (d.key === "sealed" || d.key === "drift" || d.key === "mint" || d.key === "tax" || d.key === "upgrade"));
  const [tok, setTok] = useState<DemoToken | undefined>(live[0]);
  const [amount, setAmount] = useState("100");
  const [to, setTo] = useState("");
  const claimTx = useTx();
  const approveTx = useTx();
  const crossTx = useTx();
  const renameTx = useTx();
  const rawApprove = useTx();
  const rawCross = useTx();
  const [crossedAt, setCrossedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const token = tok?.address as Address | undefined;
  const recipient = (to || me || "") as Address;

  const pre = useQuery({ queryKey: ["pre", token], queryFn: () => preflightChecks(token!), enabled: !!token && !!LOCK.gate });
  const tokInfo = useQuery({ queryKey: ["tok", token], queryFn: () => readToken(token!), enabled: !!token });
  const bal = useQuery({ queryKey: ["bal", token, me], queryFn: () => balanceOf(token!, me!), enabled: !!token && !!me, refetchInterval: 8000 });
  const allowance = useQuery({
    queryKey: ["allow", token, me],
    queryFn: () => elyClient.readContract({ address: token!, abi: erc20Abi, functionName: "allowance", args: [me!, LOCK.gate!] }),
    enabled: !!token && !!me && !!LOCK.gate,
    refetchInterval: 8000,
  });
  const mirrorBal = useQuery({
    queryKey: ["mirrorbal", pre.data?.mirror, recipient],
    queryFn: async () => {
      try {
        return await heClient.readContract({ address: pre.data!.mirror!, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
      } catch {
        return null;
      }
    },
    enabled: !!pre.data?.mirror && !!recipient,
    refetchInterval: 15000,
  });

  const dec = tokInfo.data?.decimals ?? 18;
  const amt = useMemo(() => {
    try {
      return parseUnits(amount || "0", dec);
    } catch {
      return 0n;
    }
  }, [amount, dec]);

  const refresh = useCallback(() => qc.invalidateQueries(), [qc]);

  const owner = tokInfo.data?.owner && me && tokInfo.data.owner.toLowerCase() === me.toLowerCase();
  const window_ = facts.challengeWindowSeconds;
  const secondsSince = crossedAt ? Math.floor((now - crossedAt) / 1000) : 0;
  const remaining = window_ && crossedAt ? Math.max(0, window_ - secondsSince) : null;

  if (!LOCK.gate) {
    return (
      <div className="wrap">
        <Pending what="The LOCKAGE contracts are not deployed to Elysium testnet yet." how="Fund the deployer wallet and run npm run deploy. See docs/WALLETS.md." />
      </div>
    );
  }

  const allChecksOk = !!pre.data?.ok;
  const approved = (allowance.data ?? 0n) >= amt && amt > 0n;

  return (
    <div className="wrap pb-10 grid gap-8 lg:grid-cols-[340px_1fr]">
      <aside className="grid gap-3 content-start" aria-label="Demo tokens">
        <Label>Pick a demo token</Label>
        {live.map((d) => (
          <button
            key={d.key}
            data-testid={`pick-${d.key}`}
            onClick={() => {
              setTok(d);
              setCrossedAt(null);
              claimTx.reset();
              approveTx.reset();
              crossTx.reset();
            }}
            className="plate plate-hover text-left !p-4"
            style={tok?.key === d.key ? { boxShadow: "var(--lime-glow)", borderColor: "rgba(200,240,74,.8)" } : undefined}
            aria-pressed={tok?.key === d.key}
          >
            <div className="flex items-center justify-between">
              <span className="mono text-[13px]">{d.symbol}</span>
              <span className="label">{d.line}</span>
            </div>
            <div className="mt-1 text-[14px] text-ink-2">{d.blurb}</div>
          </button>
        ))}
        {me && bal.data !== undefined && token && (
          <p className="text-[13px] text-muted">
            Your balance: <span className="mono">{formatUnits(bal.data, dec)}</span> {tok?.symbol}
          </p>
        )}
      </aside>

      <Plate hover={false} className="!p-5 md:!p-8">
        <Step n={1} title="Pre-flight: five checks, live from the chain" done={allChecksOk}>
          {pre.isLoading && <p className="text-ink-2">Reading seal, factory, router and ledger…</p>}
          {pre.error && <p className="text-red">Could not read the chain: {(pre.error as Error).message.split("\n")[0]}</p>}
          {pre.data && (
            <>
              <ul className="grid gap-2" data-testid="preflight">
                {pre.data.checks.map((c) => (
                  <li key={c.id} className="flex gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: c.ok ? "var(--hairline)" : "var(--signal-red)" }} data-check={c.id} data-ok={c.ok}>
                    <span className="mt-0.5 inline-block w-3 h-3 rounded-full shrink-0" style={{ background: c.ok ? "var(--ok)" : "var(--signal-red)" }} aria-hidden />
                    <div>
                      <div className="font-medium">
                        {c.title} <span className="sr-only">{c.ok ? "passes" : "fails"}</span>
                      </div>
                      <div className="text-[14px] text-ink-2">{c.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 label" data-testid="onchain-verdict">
                LockGate.preflight on chain: {pre.data.onChain === null ? "unavailable" : codeNames[pre.data.onChain] ?? pre.data.onChain}
              </p>
            </>
          )}
        </Step>

        <Step n={2} title="Get demo tokens" done={!!bal.data && bal.data > 0n}>
          <p className="text-ink-2 text-[15px]">Each demo token hands out 1,000 once per wallet from its own reservoir.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="btn btn-ring"
              disabled={!me || !token}
              data-testid="claim"
              onClick={async () => {
                if (await claimTx.run({ address: token!, abi: driftTokenAbi as never, functionName: "claim" })) refresh();
              }}
            >
              Claim 1,000 {tok?.symbol}
            </button>
          </div>
          <TxStatus state={claimTx.state} />
        </Step>

        <Step n={3} title="Approve LockGate" done={approved}>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <label className="grid gap-1.5">
              <span className="label">Amount</span>
              <input className="field" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount to cross" data-testid="in-amount" />
            </label>
            <label className="grid gap-1.5">
              <span className="label">Recipient on HyperEVM</span>
              <input className="field" value={to || me || ""} onChange={(e) => setTo(e.target.value)} placeholder="0x…" aria-label="Recipient" />
            </label>
          </div>
          <div className="mt-3">
            <button
              className="btn btn-ring"
              disabled={!me || !token || amt === 0n}
              data-testid="approve"
              onClick={async () => {
                if (await approveTx.run({ address: token!, abi: erc20Abi as never, functionName: "approve", args: [LOCK.gate, amt] })) refresh();
              }}
            >
              Approve {amount} {tok?.symbol}
            </button>
          </div>
          <TxStatus state={approveTx.state} />
        </Step>

        <Step n={4} title="Cross through LockGate" done={crossTx.state.status === "done"}>
          <p className="text-ink-2 text-[15px]">The call is simulated against live state first. If the route drifted, you see the decoded refusal before anything is signed.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="btn btn-primary"
              disabled={!me || !token || amt === 0n}
              data-testid="cross"
              onClick={async () => {
                const h = await crossTx.run({ address: LOCK.gate!, abi: lockGateAbi as never, functionName: "cross", args: [token, amt, recipient] });
                if (h) {
                  setCrossedAt(Date.now());
                  refresh();
                }
              }}
            >
              Cross {amount} {tok?.symbol}
            </button>
            {crossTx.state.status === "error" && crossTx.state.revert && (
              <button
                className="btn btn-danger"
                data-testid="force-cross"
                onClick={async () => {
                  await crossTx.run({ address: LOCK.gate!, abi: lockGateAbi as never, functionName: "cross", args: [token, amt, recipient], force: { gas: 1_500_000n } });
                }}
                title="Skips the simulation so the refusal is recorded on chain"
              >
                Send anyway, record the refusal
              </button>
            )}
          </div>
          <TxStatus state={crossTx.state} />
          {crossTx.state.status === "done" && (
            <div className="mt-4 rounded-2xl border border-hairline bg-paper px-4 py-3 text-[14px]" data-testid="claim-status">
              <div className="font-medium">Locked on Elysium. The mirror mints on HyperEVM after the challenge window.</div>
              <div className="mt-1 text-ink-2">
                {window_ ? (
                  <>
                    Observed end to end: {Math.round(window_ / 60)} min. {remaining && remaining > 0 ? <span className="mono">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} left</span> : "The window has passed. Claim on the bridge."}
                  </>
                ) : (
                  <>
                    {facts.challenge ? `The rollup's configured challenge period is ${facts.challenge.confirmPeriodBlocks} HyperEVM blocks (about ${facts.challenge.configuredPeriodSeconds} s). ` : ""}
                    The observed end-to-end time is unknown until an output root covers a crossing{facts.challenge?.firstCrossingSentAt ? `: waiting since ${facts.challenge.firstCrossingSentAt.slice(11, 16)} UTC` : ""}. Elapsed for this crossing: <span className="mono">{secondsSince}s</span>.
                  </>
                )}{" "}
                <a className="underline" href="https://elysium.kinetiq.xyz/bridge" target="_blank" rel="noreferrer">
                  Claim on the bridge
                </a>
                .
              </div>
              <div className="mt-1">Mirror balance for recipient: <span className="mono" data-testid="mirror-balance">{mirrorBal.data === null || mirrorBal.data === undefined ? "not minted yet" : formatUnits(mirrorBal.data, dec)}</span></div>
            </div>
          )}
        </Step>

        {tok?.key === "drift" && (
          <Step n={5} title="The failure: rename this token and try again">
            <p className="text-ink-2 text-[15px]">
              The renameable demo token. A rename moves the canonical mirror, the seal no longer matches, and LockGate refuses. The raw router has no such memory and still accepts the old mirror.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                className="btn btn-danger"
                disabled={!me || !owner}
                data-testid="rename"
                title={owner ? "" : "Only the token owner can rename. Everyone else can still try the crossing: it is already refused if the owner renamed it."}
                onClick={async () => {
                  const sym = (tokInfo.data?.symbol ?? "LDRIFT").endsWith("2") ? "LDRIFT" : (tokInfo.data?.symbol ?? "LDRIFT") + "2";
                  if (await renameTx.run({ address: token!, abi: driftTokenAbi as never, functionName: "setSymbol", args: [sym] })) refresh();
                }}
              >
                Rename the demo token and try again
              </button>
              <button
                className="btn btn-ring"
                disabled={!me || !pre.data}
                data-testid="raw-cross"
                onClick={async () => {
                  const seal = await readSeal(token!);
                  const pair = await readPair(token!);
                  if (!seal?.sealed || !pair.wallet) return;
                  if ((allowance.data ?? 0n) < 0n) return;
                  const ok = await rawApprove.run({ address: token!, abi: erc20Abi as never, functionName: "approve", args: [pair.wallet, amt] });
                  if (ok) await rawCross.run({ address: ADDR.elysium.router, abi: routerAbi as never, functionName: "outboundTransfer", args: [seal.mirror, recipient, amt, 0n, 0n, "0x"] });
                }}
              >
                Same crossing on the raw route
              </button>
            </div>
            {!owner && me && <p className="mt-2 text-[13px] text-muted">You are not the owner of this token, so the rename button is disabled. If the owner already renamed it, step 4 shows the real refusal.</p>}
            <TxStatus state={renameTx.state} />
            <p className="mt-3 label">Raw route</p>
            <TxStatus state={rawApprove.state} />
            <TxStatus state={rawCross.state} />
            {rawCross.state.status === "done" && rawCross.state.hash && (
              <p className="mt-2 text-[14px]">
                The raw route accepted the crossing keyed on the old mirror: <TxLink hash={rawCross.state.hash} />
              </p>
            )}
          </Step>
        )}
      </Plate>
    </div>
  );
}
