/**
 * Control set. Scores the bytecode selector heuristic against ground truth obtained by EXECUTION, a different
 * method from the one under test: for each sampled token with an owner(), simulate (eth_call, no funds, no
 * state change) mint and rename calls as that owner. A call that does not revert proves the capability exists.
 * A revert does not prove it is absent (a token may use different names or arguments), so ground truth here
 * is one-sided: "proven mintable" and "proven renameable". False negatives of the heuristic are therefore
 * lower bounds, and that is stated on the census page.
 *
 * Both error directions are reported and every miss is named by address.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { encodeFunctionData, parseAbi, type Address } from "viem";
import { ely, today } from "./_env";

type Row = { address: Address; symbol: string; owner: Address | null; flags: string[]; verdict: string };
const rows = (JSON.parse(readFileSync("data/census.json", "utf8")).tokens as Row[]).filter((r) => r.owner && r.owner !== "0x0000000000000000000000000000000000000000" && r.verdict !== "invalid");
const flagged = rows.filter((r) => r.flags.includes("mint") || r.flags.includes("rename"));
const unflagged = rows.filter((r) => !r.flags.includes("mint") && !r.flags.includes("rename"));
const sample = [...flagged.slice(0, 15), ...unflagged.slice(0, 15)];

const abi = parseAbi([
  "function mint(address,uint256)",
  "function mint(uint256)",
  "function setName(string)",
  "function setSymbol(string)",
  "function updateName(string)",
  "function updateSymbol(string)",
  "function changeName(string)",
  "function changeSymbol(string)",
  "function rename(string,string)",
]);

async function sim(token: Address, from: Address, data: `0x${string}`) {
  try {
    await ely.call({ account: from, to: token, data });
    return true;
  } catch {
    return false;
  }
}

const out: { address: string; symbol: string; heuristicMint: boolean; heuristicRename: boolean; provenMint: boolean; provenRename: boolean }[] = [];
for (const r of sample) {
  const from = r.owner!;
  const mintCalls = [
    encodeFunctionData({ abi, functionName: "mint", args: [from, 1n] } as never),
    encodeFunctionData({ abi: parseAbi(["function mint(uint256)"]), functionName: "mint", args: [1n] }),
  ];
  const renameCalls = [
    ...["setName", "setSymbol", "updateName", "updateSymbol", "changeName", "changeSymbol"].map((fn) => encodeFunctionData({ abi, functionName: fn, args: ["LOCKTEST"] } as never)),
    encodeFunctionData({ abi, functionName: "rename", args: ["LOCKTEST", "LTST"] } as never),
  ];
  let provenMint = false;
  for (const d of mintCalls) provenMint ||= await sim(r.address, from, d);
  let provenRename = false;
  for (const d of renameCalls) provenRename ||= await sim(r.address, from, d);
  out.push({ address: r.address, symbol: r.symbol, heuristicMint: r.flags.includes("mint"), heuristicRename: r.flags.includes("rename"), provenMint, provenRename });
}

const score = (h: "heuristicMint" | "heuristicRename", p: "provenMint" | "provenRename") => ({
  truePositives: out.filter((x) => x[h] && x[p]).length,
  falsePositives: out.filter((x) => x[h] && !x[p]).map((x) => ({ address: x.address, symbol: x.symbol, note: "heuristic flagged it, simulation did not prove it (a different function name or guard may be in use)" })),
  falseNegatives: out.filter((x) => !x[h] && x[p]).map((x) => ({ address: x.address, symbol: x.symbol, note: "simulation proves the capability, the selector scan missed it" })),
});
const mint = score("heuristicMint", "provenMint");
const rename = score("heuristicRename", "provenRename");
const misses = [
  ...mint.falseNegatives.map((m) => ({ ...m, note: "mint: " + m.note })),
  ...mint.falsePositives.map((m) => ({ ...m, note: "mint: " + m.note })),
  ...rename.falseNegatives.map((m) => ({ ...m, note: "rename: " + m.note })),
  ...rename.falsePositives.map((m) => ({ ...m, note: "rename: " + m.note })),
];
const report = {
  ranOn: today(),
  method: "ground truth by execution: eth_call as owner(); one-sided (a revert does not prove absence)",
  sampled: out.length,
  mint: { truePositives: mint.truePositives, falsePositives: mint.falsePositives.length, falseNegatives: mint.falseNegatives.length },
  rename: { truePositives: rename.truePositives, falsePositives: rename.falsePositives.length, falseNegatives: rename.falseNegatives.length },
  rows: out,
};
writeFileSync("data/control-set.json", JSON.stringify(report, null, 2));
writeFileSync("data/census-misses.json", JSON.stringify(misses, null, 2));
console.log(JSON.stringify({ ...report, rows: undefined }, null, 1), "\nmisses:", misses.length);
