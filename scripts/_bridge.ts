import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseGwei, type Address, type Hex } from "viem";
import { ely, he, sleep, walletFor } from "./_env";
import { ADDR } from "../src/lib/chains";
import { bridgeFactoryAbi, erc20Abi, lockSurveyAbi, mirrorFactoryAbi, routerAbi } from "../src/lib/abi";

export type Step = { step: string; chain: "elysium" | "hyperevm"; txHash?: Hex; status: "ok" | "reverted" | "skipped" | "accepted" | "refused"; gasUsed?: string; note?: string; error?: string };

export const deployments = () => JSON.parse(readFileSync("data/deployments.json", "utf8")) as { contracts: Record<string, { address: Address; block: number }> };
export const dep = (n: string) => {
  const c = deployments().contracts[n];
  if (!c) throw new Error(`${n} is not deployed. Run npm run deploy first.`);
  return c.address;
};

export const dWalletEly = () => walletFor("DEPLOYER_PK", "ely");
export const dWalletHe = () => walletFor("DEPLOYER_PK", "he");

export async function sendEly(name: string, req: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }, who: "DEPLOYER_PK" | "BUILDER_PK" | "HOLDER_PK" = "DEPLOYER_PK"): Promise<Step> {
  const w = walletFor(who, "ely");
  try {
    const hash = await w.writeContract({ ...req, chain: w.chain, account: w.account } as never);
    const rc = await ely.waitForTransactionReceipt({ hash, timeout: 90_000 });
    console.log(" ", name, rc.status, hash);
    return { step: name, chain: "elysium", txHash: hash, status: rc.status === "success" ? "ok" : "reverted", gasUsed: rc.gasUsed.toString() };
  } catch (e) {
    const msg = String((e as Error).message).split("\n")[0].slice(0, 160);
    console.log(" ", name, "failed:", msg);
    return { step: name, chain: "elysium", status: "reverted", error: msg };
  }
}

/** Registration parameters from the Elysium docs, with a gas price bid above the live 0.1 gwei so messages execute. */
export function registrationParams(creditBack: Address) {
  const gasPriceBid = parseGwei("0.3");
  const maxGas = 300_000n;
  const maxSubmissionCost = 400_000_000_000_000n; // 4e14
  const valueEach = maxSubmissionCost + maxGas * gasPriceBid;
  return {
    value: 2n * valueEach,
    params: {
      maxSubmissionCostForGateway: maxSubmissionCost,
      maxSubmissionCostForRouter: maxSubmissionCost,
      maxGasForGateway: maxGas,
      maxGasForRouter: maxGas,
      gasPriceBid,
      valueForGateway: valueEach,
      valueForRouter: valueEach,
      creditBackAddress: creditBack,
    },
  };
}

export async function readMeta(token: Address) {
  const [name, symbol, decimals] = await Promise.all([
    ely.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
    ely.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    ely.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return { name, symbol, decimals };
}

export const mirrorOf = (token: Address) => ely.readContract({ address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "expectedL1Mirror", args: [token] });
export const walletOf = (token: Address) => ely.readContract({ address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "l2WalletFor", args: [token] });
export const gatewayOf = (mirror: Address) => ely.readContract({ address: ADDR.elysium.router, abi: routerAbi, functionName: "getGateway", args: [mirror] }).catch(() => null);

/** Seal, deploy the escrow wallet, deploy and register the mirror, wait for the Elysium-side route. */
export async function setupPair(token: Address): Promise<Step[]> {
  const steps: Step[] = [];
  const survey = dep("LockSurvey");
  const meta = await readMeta(token);
  const mirror = await mirrorOf(token);
  console.log(`pair ${meta.symbol} ${token} -> mirror ${mirror}`);

  steps.push(await sendEly(`seal ${meta.symbol}`, { address: survey, abi: lockSurveyAbi, functionName: "seal", args: [token] }));

  if ((await walletOf(token)) === "0x0000000000000000000000000000000000000000") {
    steps.push(await sendEly(`createL2Wallet ${meta.symbol}`, { address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "createL2Wallet", args: [token] }));
  } else steps.push({ step: `createL2Wallet ${meta.symbol}`, chain: "elysium", status: "skipped", note: "wallet exists" });

  const code = await he.getCode({ address: mirror });
  if (!code || code === "0x") {
    const w = dWalletHe();
    const { value, params } = registrationParams(w.account.address);
    try {
      const hash = await w.writeContract({ address: ADDR.hyperevm.mirrorFactory, abi: mirrorFactoryAbi, functionName: "createAndRegisterL1Mirror", args: [token, meta.name, meta.symbol, meta.decimals, params], value, chain: w.chain, account: w.account });
      const rc = await he.waitForTransactionReceipt({ hash, timeout: 90_000 });
      console.log("  createAndRegisterL1Mirror", rc.status, hash);
      steps.push({ step: `createAndRegisterL1Mirror ${meta.symbol}`, chain: "hyperevm", txHash: hash, status: rc.status === "success" ? "ok" : "reverted", gasUsed: rc.gasUsed.toString() });
    } catch (e) {
      const msg = String((e as Error).message).split("\n")[0].slice(0, 200);
      steps.push({ step: `createAndRegisterL1Mirror ${meta.symbol}`, chain: "hyperevm", status: "reverted", error: msg });
      console.log("  mirror registration failed:", msg);
    }
  } else steps.push({ step: `createAndRegisterL1Mirror ${meta.symbol}`, chain: "hyperevm", status: "skipped", note: "mirror already deployed" });

  // wait for the two Elysium-side delivery messages
  for (let i = 0; i < 60; i++) {
    const gw = await gatewayOf(mirror);
    if (gw && gw.toLowerCase() === ADDR.elysium.walletGateway.toLowerCase()) {
      steps.push({ step: `route registered ${meta.symbol}`, chain: "elysium", status: "ok", note: `after ~${i * 10}s` });
      return steps;
    }
    await sleep(10_000);
  }
  steps.push({ step: `route registered ${meta.symbol}`, chain: "elysium", status: "reverted", error: "router did not register the mirror within 10 minutes" });
  return steps;
}

export function saveJson(path: string, v: unknown) {
  writeFileSync(path, JSON.stringify(v, null, 2));
}
export const loadJson = <T>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback);
