/**
 * The HyperCore graduation envelope. TypeScript twin of LockSurvey.envelope (Solidity).
 * Both are fed the same 10,000 vectors in CI; any divergence fails the build.
 *
 * Rules (elysium.kinetiq.xyz/docs/hypercore-spot-deployment, step 1):
 *  - Core amounts are uint64 in Core wei (weiDecimals places)
 *  - szDecimals + 5 <= weiDecimals, szDecimals >= 0   => weiDecimals >= 5
 *  - evmExtraWeiDecimals = underlying decimals - weiDecimals, in [-2, 18]
 *  - a deposit must be a multiple of 10^(d - w) base units when w < d, else AmountNotCoreAligned
 */
export const CORE_MAX = (1n << 64n) - 1n;
export const HEADROOM_BPS = 9000n;
export const CAP = (CORE_MAX * HEADROOM_BPS) / 10000n;
export const MIN_WEI = 5;
export const MAX_WEI = 8;
export const MAX_EXTRA_NEG = 2;
export const MAX_EXTRA_POS = 18;

export type Envelope = {
  graduates: boolean;
  bestWei: number;
  maxSz: number;
  evmExtra: number;
  alignUnit: bigint;
  coreSupplyWei: bigint;
};

export const NO_ENVELOPE: Envelope = {
  graduates: false,
  bestWei: 0,
  maxSz: 0,
  evmExtra: 0,
  alignUnit: 0n,
  coreSupplyWei: 0n,
};

export type FitResult = { ok: boolean; core: bigint; unit: bigint; reason?: "overflow" | "unaligned" };

export function fit(d: number, supplyBase: bigint, w: number): FitResult {
  let unit = 1n;
  let core: bigint;
  if (w >= d) {
    const mult = 10n ** BigInt(w - d);
    if (supplyBase > CAP / mult) return { ok: false, core: 0n, unit, reason: "overflow" };
    core = supplyBase * mult;
  } else {
    unit = 10n ** BigInt(d - w);
    if (supplyBase % unit !== 0n) return { ok: false, core: 0n, unit, reason: "unaligned" };
    core = supplyBase / unit;
  }
  if (core > CAP) return { ok: false, core, unit, reason: "overflow" };
  return { ok: true, core, unit };
}

export function bounds(d: number): { lo: number; hi: number } {
  const hi = Math.min(d + MAX_EXTRA_NEG, MAX_WEI);
  const lo = Math.max(MIN_WEI, d > MAX_EXTRA_POS ? d - MAX_EXTRA_POS : 0);
  return { lo, hi };
}

export function envelope(d: number, supplyBase: bigint): Envelope {
  if (supplyBase === 0n) return NO_ENVELOPE;
  const { lo, hi } = bounds(d);
  if (lo > hi) return NO_ENVELOPE;
  for (let w = hi; w >= lo; w--) {
    const r = fit(d, supplyBase, w);
    if (r.ok) {
      return { graduates: true, bestWei: w, maxSz: w - MIN_WEI, evmExtra: d - w, alignUnit: r.unit, coreSupplyWei: r.core };
    }
  }
  return NO_ENVELOPE;
}

export type Reason = { code: "zero" | "decimals" | "unaligned" | "supply"; text: string; rule: string };

/** Why a design cannot graduate, in the builder's language, with the rule cited. */
export function explain(d: number, supplyBase: bigint): Reason | null {
  if (envelope(d, supplyBase).graduates) return null;
  if (supplyBase === 0n) {
    return { code: "zero", text: "Supply is zero. There is nothing to put on the orderbook.", rule: "HIP-1 genesis must fund the system address" };
  }
  const { lo, hi } = bounds(d);
  if (lo > hi) {
    return {
      code: "decimals",
      text: `${d} decimals leaves no allowed weiDecimals. The link scales by 10^(decimals - weiDecimals), which must stay within [-2, 18], and weiDecimals cannot exceed ${MAX_WEI}.`,
      rule: "evmExtraWeiDecimals in [-2, 18]; szDecimals + 5 <= weiDecimals",
    };
  }
  const overflowAtCoarsest = fit(d, supplyBase, lo).reason === "overflow";
  if (!overflowAtCoarsest) {
    return {
      code: "unaligned",
      text: `Supply is not a whole multiple of 10^${Math.max(0, d - hi)} base units, so holder deposits could not be core-aligned at any granularity.`,
      rule: "Unaligned deposits revert AmountNotCoreAligned",
    };
  }
  return {
    code: "supply",
    text: `Even at the coarsest granularity (weiDecimals ${lo}) this supply overflows the 64-bit Core ceiling. It can never graduate.`,
    rule: "Core amounts are uint64 in Core wei",
  };
}

/** Largest whole-token supply that still graduates at the given decimals (coarsest allowed granularity). */
export function maxWholeSupply(d: number): bigint {
  const { lo, hi } = bounds(d);
  if (lo > hi) return 0n;
  return CAP / 10n ** BigInt(lo);
}
