"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useConnect, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { elysiumTestnet, hyperEvmTestnet } from "@/lib/chains";
import { short } from "./ui";

function PowerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.4 6.8a8 8 0 1 0 11.2 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connectors = useConnectors();
  const { connectAsync, isPending, error, variables } = useConnect();
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLButtonElement>("button[data-wallet]")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  // EIP-6963 announced wallets carry an rdns id; hide the generic injected fallback when real wallets exist
  const announced = connectors.filter((c) => c.id !== "injected");
  const list = announced.length ? announced : connectors;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Connect a wallet" data-testid="wallet-modal">
      <button className="absolute inset-0 bg-[rgba(18,20,12,0.45)] backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div ref={ref} className="plate relative w-full max-w-[420px]" style={{ background: "var(--paper)", boxShadow: "var(--lime-glow)" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="label">Connect</div>
            <h2 className="display text-[34px] mt-1">Choose a wallet</h2>
          </div>
          <button className="btn btn-ring btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-3 text-[14px] text-ink-2">Elysium testnet (99801) and HyperEVM testnet (998). The wallet signs everything. No server ever holds a key.</p>
        <ul className="mt-5 grid gap-2.5">
          {list.map((c) => (
            <li key={c.uid}>
              <button
                data-wallet={c.id}
                className="w-full flex items-center gap-3 rounded-2xl border border-hairline bg-paper-2 px-4 py-3 text-left transition hover:shadow-[var(--lime-glow)]"
                disabled={isPending}
                onClick={async () => {
                  setErr(null);
                  try {
                    await connectAsync({ connector: c, chainId: elysiumTestnet.id });
                    onClose();
                  } catch (e) {
                    setErr((e as Error).message.split("\n")[0]);
                  }
                }}
              >
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" width={28} height={28} className="rounded-md" />
                ) : (
                  <span className="grid place-items-center w-7 h-7 rounded-md border border-hairline mono text-[11px]">W</span>
                )}
                <span className="font-medium">{c.name}</span>
                {isPending && variables?.connector && "uid" in variables.connector && variables.connector.uid === c.uid ? <span className="ml-auto label">Waiting</span> : null}
              </button>
            </li>
          ))}
          {!list.length || (list.length === 1 && list[0].id === "injected" && typeof window !== "undefined" && !(window as unknown as { ethereum?: unknown }).ethereum) ? (
            <li className="rounded-2xl border border-dashed border-hairline p-4 text-[14px] text-ink-2">
              No wallet found in this browser. Install one such as{" "}
              <a className="underline" href="https://rabby.io" target="_blank" rel="noreferrer">
                Rabby
              </a>{" "}
              or{" "}
              <a className="underline" href="https://metamask.io" target="_blank" rel="noreferrer">
                MetaMask
              </a>
              , then reload.
            </li>
          ) : null}
        </ul>
        {(err || error) && (
          <p className="mt-4 text-[13px]" style={{ color: "var(--signal-red)" }} role="alert">
            {err ?? error?.message.split("\n")[0]}
          </p>
        )}
      </div>
    </div>
  );
}

export function NetworkPill() {
  const chainId = useChainId();
  const { chain, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  if (!isConnected) return null;
  const ok = chain?.id === elysiumTestnet.id || chain?.id === hyperEvmTestnet.id;
  if (ok) return null;
  return (
    <button
      className="btn btn-ring btn-sm"
      disabled={isPending}
      data-testid="switch-network"
      onClick={() => switchChainAsync({ chainId: elysiumTestnet.id }).catch(() => undefined)}
      title={`Wallet is on chain ${chain?.id ?? chainId}`}
    >
      Switch to Elysium
    </button>
  );
}

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <span className="btn btn-primary btn-sm opacity-0" aria-hidden>Connect</span>;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2" data-testid="wallet-connected">
        <NetworkPill />
        <span className="inline-flex items-center gap-2 h-9 rounded-full border border-hairline bg-paper-2 pl-3 pr-1.5 mono text-[13px]" title={`${address} on ${chain?.name ?? "unknown network"}`}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: chain?.id === elysiumTestnet.id || chain?.id === hyperEvmTestnet.id ? "var(--ok)" : "var(--signal-amber)" }} />
          <span data-testid="wallet-address">{short(address)}</span>
          <button className="grid place-items-center w-6 h-6 rounded-full hover:bg-paper-3" aria-label="Disconnect wallet" title="Disconnect" onClick={() => disconnect()} data-testid="wallet-disconnect">
            <PowerIcon />
          </button>
        </span>
      </div>
    );
  }
  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="connect-wallet">
        Connect
      </button>
      <WalletModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
