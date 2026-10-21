import raw from "../../docs/FACTS.json";

export type Facts = {
  generatedAt: string;
  tests: { total: number; passed: number; failed: number; fuzzRunsPerProperty: number; twinVectors: number | null } | null;
  census: {
    ranOn: string;
    headBlock: number;
    candidates: number;
    surveyed: number;
    canGraduateAsIs: number;
    graduatesByMathAlone: number;
    blockedBySupplyOrDecimals: number;
    mutableMetadata: number;
    mintable: number;
    taxOrRebaseLikely: number;
    unreadableProxy: number;
    withBridgeWallet: number;
    [k: string]: unknown;
  } | null;
  controlSet: Record<string, unknown> | null;
  drift: Record<string, unknown> | null;
  counterfactual: Record<string, unknown> | null;
  challengeWindowSeconds: number | null;
  challenge: { confirmPeriodBlocks: number; hyperEvmBlockTimeSeconds: number; configuredPeriodSeconds: number; firstCrossingSentAt: string | null; observedEndToEndSeconds: number | null; readAt: string } | null;
  auction: { ranOn: string; mainnet?: { tickerPriceHype?: string }; testnet?: { tickerPriceHype?: string } } | null;
  upgrade: Record<string, unknown> | null;
  driftC: Record<string, unknown> | null;
  envelopeVerification: Record<string, unknown> | null;
  hypercoreSnapshot: { ranOn: string; tokens: number } | null;
  deployments: { contractCount: number; totalDeployFeeWei: string; contracts: Record<string, { address: string; txHash: string; gasUsed: string; feeWei: string; deployedOn: string }> } | null;
  costs: Record<string, unknown> | null;
  keeper: { lastRun: string; sweeps: number; decisionsAsked: number; openFindings: number } | null;
};

export const facts = raw as unknown as Facts;

/** "412 of 1,031" style share, or null when the census has not run. */
export function pct(n: number | undefined, d: number | undefined): string | null {
  if (n === undefined || !d) return null;
  const v = (n / d) * 100;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
}
