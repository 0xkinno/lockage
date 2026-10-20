/**
 * D1: mirror identity drift, answered by experiment on testnet. Also records the counterfactual
 * (baseline / control / intervention) with every tx hash. Requires `npm run deploy` and `npm run setup`.
 *
 *   baseline:     raw router accepts a crossing keyed on the stale mirror after a rename
 *   control:      SealedToken crosses through LockGate
 *   intervention: DriftToken after the rename is refused by LockGate
 */
import { BaseError, ContractFunctionRevertedError, formatUnits, parseUnits, type Address } from "viem";
import { ely, he, today, account } from "./_env";
import { dep, dWalletHe, gatewayOf, mirrorOf, readMeta, registrationParams, saveJson, sendEly, walletOf, type Step } from "./_bridge";
import { ADDR } from "../src/lib/chains";
import { bridgeFactoryAbi, driftTokenAbi, erc20Abi, lockGateAbi, mirrorFactoryAbi, routerAbi } from "../src/lib/abi";

const me = account("DEPLOYER_PK").address;
const DRIFT = dep("DriftToken");
const SEALED = dep("SealedToken");
const GATE = dep("LockGate");
const amt = parseUnits("100", 18);
const steps: Step[] = [];
const rec = (s: Step) => (steps.push(s), s);

async function ensureClaim(token: Address, label: string) {
  const bal = await ely.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [me] });
  if (bal >= amt * 3n) return;
  const claimed = await ely.readContract({ address: token, abi: [{ type: "function", name: "claimed", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] }] as const, functionName: "claimed", args: [me] });
  if (!claimed) rec(await sendEly(`claim ${label}`, { address: token, abi: driftTokenAbi, functionName: "claim" }));
}

async function decodeSim(call: () => Promise<unknown>): Promise<string> {
  try {
    await call();
    return "did not revert";
  } catch (e) {
    if (e instanceof BaseError) {
      const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
      if (r?.data) return r.data.errorName;
      return e.shortMessage;
    }
    return String(e).slice(0, 100);
  }
}

const meta0 = await readMeta(DRIFT);
const oldMirror = await mirrorOf(DRIFT);
const wallet = await walletOf(DRIFT);
if (wallet === "0x0000000000000000000000000000000000000000") throw new Error("Run npm run setup first: DriftToken has no escrow wallet.");
console.log("drift token", DRIFT, meta0, "old mirror", oldMirror);

await ensureClaim(DRIFT, "LDRIFT");
await ensureClaim(SEALED, "LSEAL");

// ---- baseline pre-rename: raw crossing works
rec(await sendEly("approve wallet (drift)", { address: DRIFT, abi: erc20Abi, functionName: "approve", args: [wallet, amt * 3n] }));
const rawPre = rec(await sendEly("raw crossing before rename (baseline pre)", { address: ADDR.elysium.router, abi: routerAbi, functionName: "outboundTransfer", args: [oldMirror, me, amt, 0n, 0n, "0x"] }));

// ---- control: LockGate with the immutable token
rec(await sendEly("approve LockGate (sealed)", { address: SEALED, abi: erc20Abi, functionName: "approve", args: [GATE, amt] }));
const control = rec(await sendEly("control: LockGate crossing of LSEAL", { address: GATE, abi: lockGateAbi, functionName: "cross", args: [SEALED, amt, me] }));
const controlCrossedAt = Date.now();

// ---- the rename
const newSymbol = meta0.symbol.endsWith("2") ? meta0.symbol : meta0.symbol + "2";
const renameStep = rec(await sendEly(`rename ${meta0.symbol} -> ${newSymbol}`, { address: DRIFT, abi: driftTokenAbi, functionName: "setSymbol", args: [newSymbol] }));
const newMirror = await mirrorOf(DRIFT);
const mirrorMoved = newMirror.toLowerCase() !== oldMirror.toLowerCase();
console.log("mirror moved:", mirrorMoved, oldMirror, "->", newMirror);

// (a) does the old wallet still accept locks keyed on the old mirror?
const rawPost = rec(await sendEly("raw crossing keyed on OLD mirror after rename (baseline)", { address: ADDR.elysium.router, abi: routerAbi, functionName: "outboundTransfer", args: [oldMirror, me, amt, 0n, 0n, "0x"] }));
const oldGwAfter = await gatewayOf(oldMirror);

// (b) can a second wallet be created for the new metadata?
const wallet2Before = await walletOf(DRIFT);
const second = rec(await sendEly("createL2Wallet again after rename", { address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "createL2Wallet", args: [DRIFT] }));
const wallet2After = await walletOf(DRIFT);
const secondWalletCreated = wallet2After.toLowerCase() !== wallet2Before.toLowerCase();

// (c) register a mirror for the new metadata and try crossing keyed on it
let newMirrorUsable = "not attempted";
try {
  const hw = dWalletHe();
  const { value, params } = registrationParams(hw.account.address);
  const meta1 = await readMeta(DRIFT);
  const h = await hw.writeContract({ address: ADDR.hyperevm.mirrorFactory, abi: mirrorFactoryAbi, functionName: "createAndRegisterL1Mirror", args: [DRIFT, meta1.name, meta1.symbol, meta1.decimals, params], value, chain: hw.chain, account: hw.account });
  const rc = await he.waitForTransactionReceipt({ hash: h });
  rec({ step: "register mirror for the NEW metadata", chain: "hyperevm", txHash: h, status: rc.status === "success" ? "ok" : "reverted", gasUsed: rc.gasUsed.toString() });
  for (let i = 0; i < 40; i++) {
    const gw = await gatewayOf(newMirror);
    if (gw && gw.toLowerCase() === ADDR.elysium.walletGateway.toLowerCase()) break;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  const s = rec(await sendEly("raw crossing keyed on NEW mirror", { address: ADDR.elysium.router, abi: routerAbi, functionName: "outboundTransfer", args: [newMirror, me, amt, 0n, 0n, "0x"] }));
  newMirrorUsable = s.status === "ok" ? "accepted" : `refused (${s.error ?? "reverted"})`;
} catch (e) {
  newMirrorUsable = "could not register: " + String((e as Error).message).split("\n")[0].slice(0, 120);
}

// ---- intervention: LockGate after the rename
const refusal = await decodeSim(() => ely.simulateContract({ account: me, address: GATE, abi: lockGateAbi, functionName: "cross", args: [DRIFT, amt, me] }));
console.log("LockGate simulation after rename:", refusal);
let interventionHash: `0x${string}` | undefined;
let interventionStatus: Step["status"] = "refused";
try {
  const w = (await import("./_env")).walletFor("DEPLOYER_PK", "ely");
  interventionHash = await w.writeContract({ address: GATE, abi: lockGateAbi, functionName: "cross", args: [DRIFT, amt, me], gas: 1_500_000n, chain: w.chain, account: w.account });
  const rc = await ely.waitForTransactionReceipt({ hash: interventionHash });
  interventionStatus = rc.status === "reverted" ? "refused" : "ok";
} catch (e) {
  console.log("intervention send failed:", String((e as Error).message).split("\n")[0]);
}
const intervention: Step = { step: "intervention: LockGate crossing of renamed LDRIFT", chain: "elysium", txHash: interventionHash, status: interventionStatus, error: refusal };
rec(intervention);

// ---- on-chain verdict from preflight
const pf = await ely.readContract({ address: GATE, abi: lockGateAbi, functionName: "preflight", args: [DRIFT] });

const supplyOld = await he.readContract({ address: oldMirror, abi: erc20Abi, functionName: "totalSupply" }).catch(() => null);
const supplyNew = await he.readContract({ address: newMirror, abi: erc20Abi, functionName: "totalSupply" }).catch(() => null);

const outcomes: Record<string, string> = {
  "Does the factory name a new canonical mirror after a rename?": mirrorMoved ? `Yes. expectedL1Mirror moved from ${oldMirror} to ${newMirror}.` : "No. The mirror did not move.",
  "(a) Does the old wallet still accept locks keyed on the old mirror?": rawPost.status === "ok" ? `Yes. The raw router accepted the crossing (${rawPost.txHash}). Old route gateway is ${oldGwAfter}.` : `No. The raw router refused: ${rawPost.error ?? "reverted"}.`,
  "(b) Can a second wallet be created for the new metadata?": secondWalletCreated ? `Yes. A new wallet ${wallet2After} was created.` : `No. l2WalletFor still returns ${wallet2After}. createL2Wallet ${second.status === "ok" ? "succeeded without creating a new wallet" : "reverted: " + (second.error ?? "")}.`,
  "(c) After crossing again, do two mirrors with nonzero supply exist?": `Mirror supply on HyperEVM, old: ${supplyOld === null ? "not deployed or unreadable" : formatUnits(supplyOld, 18)}, new: ${supplyNew === null ? "not deployed or unreadable" : formatUnits(supplyNew, 18)}. Crossing keyed on the new mirror: ${newMirrorUsable}. Supply only mints after the challenge window, so re-read these after it passes (the keeper does).`,
  "What does LockGate do after the rename?": `Refused with ${refusal}. Preflight code ${pf[0]}.`,
};
console.log(outcomes);

const date = today();
saveJson(`data/experiments/drift-${date}.json`, { ranOn: date, token: DRIFT, oldMirror, newMirror, steps, outcomes, firstControlCrossingAt: new Date(controlCrossedAt).toISOString() });
saveJson(`data/experiments/counterfactual-${date}.json`, {
  ranOn: date,
  baseline: { step: "Raw route, after rename", txHash: rawPost.txHash, chain: "elysium", status: rawPost.status === "ok" ? "accepted" : "reverted", error: rawPost.error },
  control: { step: "LockGate, immutable token", txHash: control.txHash, chain: "elysium", status: control.status === "ok" ? "accepted" : "reverted" },
  intervention: { step: "LockGate, after rename", txHash: interventionHash, chain: "elysium", status: interventionStatus === "refused" ? "reverted" : "accepted", error: refusal },
  rawPre: { txHash: rawPre.txHash },
  rename: { txHash: renameStep.txHash },
});
console.log("experiment saved");
