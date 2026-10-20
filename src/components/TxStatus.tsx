"use client";

import type { TxState } from "@/lib/useTx";
import { TxLink } from "./ui";

const COPY: Record<TxState["status"], string> = {
  idle: "",
  simulating: "Checking the call against live state…",
  wallet: "Confirm in your wallet…",
  pending: "Waiting for the block…",
  done: "Confirmed.",
  error: "Refused.",
};

export function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;
  const bad = state.status === "error";
  return (
    <div className={`mt-3 rounded-2xl border px-4 py-3 text-[14px] ${bad ? "border-red" : "border-hairline"}`} role="status" aria-live="polite" data-testid="tx-status" data-status={state.status}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={bad ? "text-red font-medium" : "font-medium"}>{COPY[state.status]}</span>
        {state.hash && <TxLink hash={state.hash} />}
      </div>
      {state.error && (
        <div className="mt-1 mono text-[12px] text-red" data-testid="tx-error">
          {state.revert ? `${state.revert.name}${state.revert.args?.length ? `(${state.revert.args.map((a) => String(a).slice(0, 12)).join(", ")}…)` : ""}` : state.error}
        </div>
      )}
    </div>
  );
}
