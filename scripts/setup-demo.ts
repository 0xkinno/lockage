/**
 * Seals the demo tokens and sets up their bridge pairs (escrow wallet + registered mirror).
 * Run after `npm run deploy`. Idempotent.
 */
import { formatEther } from "viem";
import { ely, he, today } from "./_env";
import { dep, dWalletEly, loadJson, saveJson, setupPair, sendEly, type Step } from "./_bridge";
import { lockSurveyAbi } from "../src/lib/abi";

const w = dWalletEly();
console.log("deployer", w.account.address, "Elysium", formatEther(await ely.getBalance({ address: w.account.address })), "HyperEVM", formatEther(await he.getBalance({ address: w.account.address })));

const out = loadJson<{ ranOn: string; steps: Step[] }>("data/setup.json", { ranOn: today(), steps: [] });
for (const name of ["SealedToken", "DriftToken", "TaxToken", "MintToken"]) {
  out.steps.push(...(await setupPair(dep(name))));
  saveJson("data/setup.json", out);
}
// the oversize token is sealed only: it can never graduate, and has no bridge pair on purpose
out.steps.push(await sendEly("seal LBIG", { address: dep("LockSurvey"), abi: lockSurveyAbi, functionName: "seal", args: [dep("OversizeToken")] }));
out.ranOn = today();
saveJson("data/setup.json", out);
console.log("setup done; steps recorded in data/setup.json");
