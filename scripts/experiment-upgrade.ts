/**
 * The rename path no selector scan can see. UpgradeToken is a UUPS proxy with no setSymbol or setName. Seal it, cross it through
 * LockGate (control), upgrade the implementation to one that returns a new symbol, then cross again. LockGate must refuse with
 * MetadataDrift, because it reads the live metadata at call time and not the function list.
 */
import { BaseError, ContractFunctionRevertedError, formatUnits, parseUnits } from "viem";
import { ely, account, today, walletFor } from "./_env";
import { dep, mirrorOf, readMeta, saveJson, sendEly, setupPair, type Step } from "./_bridge";
import { erc20Abi, lockGateAbi, upgradeImplV1Abi } from "../src/lib/abi";

const me = account("DEPLOYER_PK").address;
const TOKEN = dep("UpgradeToken");
const V2 = dep("UpgradeImplV2");
const GATE = dep("LockGate");
const amt = parseUnits("100", 18);
const steps: Step[] = [];

const before = await readMeta(TOKEN);
const mirrorBefore = await mirrorOf(TOKEN);
console.log("before upgrade:", before.symbol, mirrorBefore);
steps.push(...(await setupPair(TOKEN)));

steps.push(await sendEly("claim LUPG", { address: TOKEN, abi: upgradeImplV1Abi, functionName: "claim" }));
steps.push(await sendEly("approve LockGate", { address: TOKEN, abi: erc20Abi, functionName: "approve", args: [GATE, amt] }));
const control = await sendEly("control: LockGate crossing before the upgrade", { address: GATE, abi: lockGateAbi, functionName: "cross", args: [TOKEN, amt, me] });
steps.push(control);

const upgrade = await sendEly("upgrade the implementation to V2 (symbol changes)", { address: TOKEN, abi: upgradeImplV1Abi, functionName: "upgradeToAndCall", args: [V2, "0x"] });
steps.push(upgrade);
const after = await readMeta(TOKEN);
const mirrorAfter = await mirrorOf(TOKEN);
console.log("after upgrade:", after.symbol, mirrorAfter, "moved:", mirrorAfter.toLowerCase() !== mirrorBefore.toLowerCase());

let refusal = "did not revert";
try {
  await ely.simulateContract({ account: me, address: GATE, abi: lockGateAbi, functionName: "cross", args: [TOKEN, amt, me] });
} catch (e) {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    refusal = r?.data?.errorName ?? e.shortMessage;
  }
}
console.log("LockGate after the upgrade:", refusal);

const w = walletFor("DEPLOYER_PK", "ely");
let hash: `0x${string}` | undefined;
let status: Step["status"] = "refused";
try {
  hash = await w.writeContract({ address: GATE, abi: lockGateAbi, functionName: "cross", args: [TOKEN, amt, me], gas: 1_500_000n, chain: w.chain, account: w.account });
  const rc = await ely.waitForTransactionReceipt({ hash });
  status = rc.status === "reverted" ? "refused" : "ok";
} catch (e) {
  console.log("forced send failed:", String((e as Error).message).split("\n")[0]);
}
const intervention: Step = { step: "intervention: LockGate crossing after the upgrade", chain: "elysium", txHash: hash, status, error: refusal };
steps.push(intervention);

saveJson(`data/experiments/upgrade-${today()}.json`, {
  ranOn: today(),
  token: TOKEN,
  implementationV2: V2,
  symbolBefore: before.symbol,
  symbolAfter: after.symbol,
  mirrorBefore,
  mirrorAfter,
  mirrorMoved: mirrorAfter.toLowerCase() !== mirrorBefore.toLowerCase(),
  noRenameFunction: "UpgradeToken exposes no setName or setSymbol: the change happened through upgradeToAndCall",
  control: { txHash: control.txHash, status: control.status },
  upgrade: { txHash: upgrade.txHash },
  intervention: { txHash: hash, status: status === "refused" ? "reverted" : "accepted", error: refusal },
  steps,
});
console.log("saved. refusal =", refusal, "tx", hash);
console.log("symbol before/after:", before.symbol, after.symbol, "balance check", formatUnits(amt, 18));
