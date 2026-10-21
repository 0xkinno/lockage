/**
 * D1 question (c), done properly. The first run of experiment-drift.ts crossed on the new mirror without approving the
 * second escrow wallet, and the revert (selector 0x13be252b) was the demo token's own InsufficientAllowance(), not a bridge
 * refusal. Here the second wallet is approved first, then the crossing keyed on the NEW mirror is sent through the raw router.
 */
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { ely, account, today } from "./_env";
import { dep, gatewayOf, mirrorOf, saveJson, sendEly, walletOf } from "./_bridge";
import { ADDR } from "../src/lib/chains";
import { erc20Abi, routerAbi } from "../src/lib/abi";

const me = account("DEPLOYER_PK").address;
const DRIFT = dep("DriftToken");
const amt = parseUnits("50", 18);
const newMirror = await mirrorOf(DRIFT);
const newWallet = await walletOf(DRIFT);
const gw = await gatewayOf(newMirror);
console.log("new mirror", newMirror, "new wallet", newWallet, "routed", gw?.toLowerCase() === ADDR.elysium.walletGateway.toLowerCase());

const steps = [];
steps.push(await sendEly("approve the SECOND escrow wallet", { address: DRIFT, abi: erc20Abi, functionName: "approve", args: [newWallet, amt] }));
const data = encodeFunctionData({ abi: routerAbi, functionName: "outboundTransfer", args: [newMirror, me as Address, amt, 0n, 0n, "0x"] });
let simulation = "passes";
try {
  await ely.call({ account: me, to: ADDR.elysium.router, data });
} catch (e) {
  simulation = "reverts: " + String((e as { shortMessage?: string }).shortMessage).slice(0, 120);
}
steps.push(await sendEly("raw crossing keyed on the NEW mirror", { address: ADDR.elysium.router, abi: routerAbi, functionName: "outboundTransfer", args: [newMirror, me, amt, 0n, 0n, "0x"] }));
const accepted = steps[1].status === "ok";
saveJson(`data/experiments/drift-c-${today()}.json`, {
  ranOn: today(),
  token: DRIFT,
  newMirror,
  newWallet,
  routed: gw?.toLowerCase() === ADDR.elysium.walletGateway.toLowerCase(),
  earlierRevertSelector: "0x13be252b",
  earlierRevertName: "InsufficientAllowance() on the demo token (missing approval to the second wallet), not a bridge refusal",
  simulation,
  steps,
  answer: accepted ? "The router accepts crossings keyed on BOTH mirrors for the same token after a rename: two live routes, one canonical." : "The router refused the crossing on the new mirror.",
});
console.log(accepted ? "accepted on the new mirror" : "refused on the new mirror", steps.map((s) => s.txHash));
