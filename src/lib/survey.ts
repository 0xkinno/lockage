import { envelope, explain, maxWholeSupply, type Envelope } from "./envelope";
import type { Scan } from "./bytecode";

export type Verdict = "pass" | "block" | "unknown";
export type LineId = "supply" | "decimals" | "metadata" | "growth" | "transfer";

export type Line = {
  id: LineId;
  title: string;
  verdict: Verdict;
  /** One plain sentence for the builder. */
  detail: string;
  /** The HyperCore or bridge rule that decides this line. */
  rule: string;
  /** What to change (block) or what would determine it (unknown). */
  fix?: string;
};

export type Survey = {
  lines: Line[];
  env: Envelope;
  /** pass only when every line passes; "unknown" when nothing blocks but something is undetermined */
  overall: Verdict;
  blocks: number;
  unknowns: number;
};

export type SurveyInput = {
  decimals: number;
  supplyBase: bigint;
  /** from the Gauger; null when no bytecode was read (design mode passes explicit flags instead) */
  scan?: Scan | null;
  /** explicit design flags (design mode) */
  design?: { rename: boolean; mint: boolean; tax: boolean };
  /** measured by LockProbe (wallet-signed); null = not measured */
  probe?: { exact: boolean } | null;
};

const fmt = (n: bigint) => n.toLocaleString("en-US");

export function runSurvey(i: SurveyInput): Survey {
  const env = envelope(i.decimals, i.supplyBase);
  const why = explain(i.decimals, i.supplyBase);
  const whole = i.supplyBase / 10n ** BigInt(i.decimals);
  const lines: Line[] = [];

  // 1 Supply fit
  if (env.graduates) {
    lines.push({
      id: "supply",
      title: "Supply fit",
      verdict: "pass",
      detail: `${fmt(whole)} tokens fit HyperCore's 64-bit ceiling at ${env.bestWei} wei decimals.`,
      rule: "Core amounts are uint64 in Core wei",
    });
  } else if (why && (why.code === "supply" || why.code === "zero" || why.code === "unaligned")) {
    lines.push({
      id: "supply",
      title: "Supply fit",
      verdict: "block",
      detail: why.text,
      rule: why.rule,
      fix: `Cap supply at ${fmt(maxWholeSupply(i.decimals))} whole tokens or fewer at ${i.decimals} decimals.`,
    });
  } else {
    lines.push({
      id: "supply",
      title: "Supply fit",
      verdict: "block",
      detail: why?.text ?? "No allowed granularity fits this supply.",
      rule: why?.rule ?? "Core amounts are uint64 in Core wei",
    });
  }

  // 2 Decimals plan
  if (env.graduates) {
    const note =
      env.alignUnit > 1n
        ? ` Every holder deposit must be a multiple of ${fmt(env.alignUnit)} base units or it reverts AmountNotCoreAligned.`
        : " Deposits map one to one.";
    lines.push({
      id: "decimals",
      title: "Decimals plan",
      verdict: "pass",
      detail: `weiDecimals ${env.bestWei}, szDecimals up to ${env.maxSz}, evmExtraWeiDecimals ${env.evmExtra}.${note}`,
      rule: "szDecimals + 5 <= weiDecimals; evmExtraWeiDecimals in [-2, 18]",
    });
  } else if (why?.code === "decimals") {
    lines.push({
      id: "decimals",
      title: "Decimals plan",
      verdict: "block",
      detail: why.text,
      rule: why.rule,
      fix: "Use 18 decimals or fewer.",
    });
  } else {
    lines.push({
      id: "decimals",
      title: "Decimals plan",
      verdict: "block",
      detail: "No weiDecimals plan exists for this decimals and supply pair.",
      rule: "szDecimals + 5 <= weiDecimals; evmExtraWeiDecimals in [-2, 18]",
      fix: "Reduce supply or change decimals so a plan exists.",
    });
  }

  const s = i.scan ?? null;
  const d = i.design ?? null;
  const unreadable = !!s?.unreadableProxy;

  // 3 Metadata identity
  const renameable = d ? d.rename : s?.rename;
  const upgradeAdmin = s?.proxyAdmin ?? null;
  const upgradeable = !!upgradeAdmin || !!s?.uups;
  if (!d && upgradeable) {
    lines.push({
      id: "metadata",
      title: "Metadata identity",
      verdict: "block",
      detail: upgradeAdmin
        ? `Identity can change by upgrade (admin ${upgradeAdmin}). An upgrade can return a new name or symbol with no rename function at all, and that moves the canonical mirror.`
        : "Identity can change by upgrade (UUPS: the implementation carries upgradeToAndCall). An upgrade can return a new name or symbol with no rename function at all, and that moves the canonical mirror.",
      rule: "Mirror identity = token + exact live name, symbol, decimals; the EIP-1967 admin slot is read from storage, not guessed",
      fix: "Renounce the upgrade authority before launch, or accept that every upgrade is a new bridge identity.",
    });
  } else if (unreadable) {
    lines.push({
      id: "metadata",
      title: "Metadata identity",
      verdict: "unknown",
      detail: "The token is a proxy and its logic could not be read, so we cannot tell if name or symbol can change.",
      rule: "Mirror identity = token + exact live name, symbol, decimals",
      fix: "Verify the implementation source on the explorer, then survey again.",
    });
  } else if (renameable) {
    lines.push({
      id: "metadata",
      title: "Metadata identity",
      verdict: "block",
      detail: "Name or symbol can change. Each change moves the canonical mirror to a new address and strands holders who crossed earlier.",
      rule: "Mutable metadata makes one mirror pair per snapshot (1:1 rule)",
      fix: "Make name and symbol immutable before launch.",
    });
  } else {
    lines.push({
      id: "metadata",
      title: "Metadata identity",
      verdict: "pass",
      detail: "No way to change name or symbol was found, and the token is not an upgradeable proxy. One bridge identity for the life of the token.",
      rule: "Mirror identity = token + exact live name, symbol, decimals",
    });
  }

  // 4 Supply growth
  const mintable = d ? d.mint : s?.mint;
  if (unreadable) {
    lines.push({
      id: "growth",
      title: "Supply growth",
      verdict: "unknown",
      detail: "Proxy logic unreadable, so we cannot tell if supply can grow.",
      rule: "Genesis supply must back every possible EVM unit",
      fix: "Verify the implementation source on the explorer, then survey again.",
    });
  } else if (mintable) {
    lines.push({
      id: "growth",
      title: "Supply growth",
      verdict: "block",
      detail: "An owner mint exists. Supply can outgrow the genesis supply HyperCore is told about, which breaks the deposit-wallet invariant.",
      rule: "Deposit-wallet escrow must cover genesis supply exactly",
      fix: "Remove mint, or renounce it before launch.",
    });
  } else {
    lines.push({
      id: "growth",
      title: "Supply growth",
      verdict: "pass",
      detail: "No mint path was found. Supply is fixed at what you launched.",
      rule: "Deposit-wallet escrow must cover genesis supply exactly",
    });
  }

  // 5 Transfer behaviour
  const taxy = d ? d.tax : s ? s.tax || s.rebase : false;
  if (i.probe) {
    lines.push(
      i.probe.exact
        ? {
            id: "transfer",
            title: "Transfer behaviour",
            verdict: "pass",
            detail: "A measured round trip delivered exactly what was sent. No tax, no rebase on move.",
            rule: "Fee-on-transfer and rebasing tokens are unsupported",
          }
        : {
            id: "transfer",
            title: "Transfer behaviour",
            verdict: "block",
            detail: "A measured round trip lost amount. Transfers change amounts, so neither the mirror bridge nor a deposit wallet can carry this token.",
            rule: "Fee-on-transfer and rebasing tokens are unsupported",
            fix: "Remove the transfer fee or rebase logic.",
          },
    );
  } else if (unreadable) {
    lines.push({
      id: "transfer",
      title: "Transfer behaviour",
      verdict: "unknown",
      detail: "Proxy logic unreadable and no probe has been run.",
      rule: "Fee-on-transfer and rebasing tokens are unsupported",
      fix: "Run the on-chain probe: it moves a small amount through and back in one transaction.",
    });
  } else if (taxy) {
    lines.push({
      id: "transfer",
      title: "Transfer behaviour",
      verdict: "block",
      detail: "Fee or rebase functions were found. Amounts probably change on transfer. Run the probe to measure it.",
      rule: "Fee-on-transfer and rebasing tokens are unsupported",
      fix: "Remove the fee or rebase logic, or prove with the probe that it is not active.",
    });
  } else {
    lines.push({
      id: "transfer",
      title: "Transfer behaviour",
      verdict: d ? "pass" : "unknown",
      detail: d
        ? "No transfer tax in the design."
        : "No fee or rebase functions found, but a scan cannot prove amounts are exact. Run the on-chain probe to measure.",
      rule: "Fee-on-transfer and rebasing tokens are unsupported",
      fix: d ? undefined : "Run the on-chain probe (one wallet-signed transaction, funds returned in the same transaction).",
    });
  }

  const blocks = lines.filter((l) => l.verdict === "block").length;
  const unknowns = lines.filter((l) => l.verdict === "unknown").length;
  return { lines, env, blocks, unknowns, overall: blocks > 0 ? "block" : unknowns > 0 ? "unknown" : "pass" };
}

/** Stable hash input for a keeper finding: what was on screen is what the builder signs. */
export function findingKey(parts: Record<string, string | number | bigint | boolean | null>): string {
  return JSON.stringify(parts, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}
