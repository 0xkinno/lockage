import deployments from "../../data/deployments.json";
import type { Address } from "viem";

type Dep = { address: string; txHash: string; gasUsed: string; feeWei: string; block: number; deployedOn: string };
const contracts = (deployments as { contracts: Record<string, Dep> }).contracts;

export const isDeployed = Boolean(contracts.LockSurvey && contracts.LockGate);

export const addr = (name: string): Address | null => (contracts[name]?.address as Address | undefined) ?? null;

export const LOCK = {
  survey: addr("LockSurvey"),
  gate: addr("LockGate"),
  ledger: addr("LockLedger"),
  probe: addr("LockProbe"),
};

export type DemoKey = "sealed" | "drift" | "oversize" | "tax" | "mint" | "upgrade";

export type DemoToken = {
  key: DemoKey;
  contract: string;
  address: Address | null;
  symbol: string;
  name: string;
  line: string;
  blurb: string;
};

export const DEMOS: DemoToken[] = [
  { key: "sealed", contract: "SealedToken", address: addr("SealedToken"), symbol: "LSEAL", name: "Lock Sealed", line: "The control", blurb: "Fixed 1B supply, 18 decimals, metadata that can never change. Crosses cleanly." },
  { key: "drift", contract: "DriftToken", address: addr("DriftToken"), symbol: "LDRIFT", name: "Lock Drift", line: "Metadata identity", blurb: "The owner can rename it. A rename moves the canonical mirror to a new address." },
  { key: "oversize", contract: "OversizeToken", address: addr("OversizeToken"), symbol: "LBIG", name: "Lock Oversize", line: "Supply fit", blurb: "One quadrillion tokens. No weiDecimals fits, so it can never graduate." },
  { key: "tax", contract: "TaxToken", address: addr("TaxToken"), symbol: "LTAX", name: "Lock Tax", line: "Transfer behaviour", blurb: "1% of every transfer is burned. Amounts never arrive exactly." },
  { key: "upgrade", contract: "UpgradeToken", address: addr("UpgradeToken"), symbol: "LUPG", name: "Lock Upgrade", line: "Upgrade path", blurb: "A UUPS proxy with no rename function. An upgrade changes its symbol, and the gate still refuses." },
  { key: "mint", contract: "MintToken", address: addr("MintToken"), symbol: "LMINT", name: "Lock Mint", line: "Supply growth", blurb: "The owner can mint without limit after the seal." },
];

export const demoByAddress = (a?: string | null) => DEMOS.find((d) => d.address && a && d.address.toLowerCase() === a.toLowerCase());

export const deploymentsRaw = deployments as { chainId: number; deployer: string; contracts: Record<string, Dep> };
