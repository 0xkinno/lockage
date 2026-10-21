// Verifies every LOCKAGE contract on the Elysium testnet explorer (Blockscout API, no key needed).
// Uses the original build settings from foundry.toml. Run after `npm run deploy`.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const local = resolve(".tools/foundry");
const env = { ...process.env, PATH: `${local}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}` };
delete env.FOUNDRY_PROFILE;
const dep = JSON.parse(readFileSync("data/deployments.json", "utf8")).contracts;
const R = "0x89659883a9d980925733B0A698F117AAb65ac718";
const G = "0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959";
const F = "0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a";
const items = [
  ["LockSurvey", "LockSurvey.sol", "constructor(address)", [F]],
  ["LockLedger", "LockLedger.sol", "constructor(address)", [dep.LockSurvey?.address]],
  ["LockGate", "LockGate.sol", "constructor(address,address,address,address)", [dep.LockSurvey?.address, dep.LockLedger?.address, R, G]],
  ["LockProbe", "LockProbe.sol"],
  ["SealedToken", "demo/DemoTokens.sol"],
  ["DriftToken", "demo/DemoTokens.sol"],
  ["OversizeToken", "demo/DemoTokens.sol"],
  ["TaxToken", "demo/DemoTokens.sol"],
  ["MintToken", "demo/DemoTokens.sol"],
  ["UpgradeImplV1", "demo/UpgradeToken.sol"],
  ["UpgradeImplV2", "demo/UpgradeToken.sol"],
  ["UpgradeToken", "demo/UpgradeToken.sol", "constructor(address,bytes)", [dep.UpgradeImplV1?.address, "__INIT__"], "LockProxy"],
];
let bad = 0;
for (const [name, file, sig, args, contractName] of items) {
  if (!dep[name]) continue;
  const cmd = ["verify-contract", dep[name].address, `contracts/src/${file}:${contractName ?? name}`, "--chain", "99801", "--verifier", "blockscout", "--verifier-url", "https://elysium.kinetiq.xyz/api/", "--watch"];
  if (sig) {
    const real = args.map((a) => (a === "__INIT__" ? spawnSync("cast", ["calldata", "initialize(address,uint256)", dep.LockSurvey ? JSON.parse(readFileSync("data/wallets.json", "utf8")).deployer : "", "1000000000"], { env, encoding: "utf8" }).stdout.trim() : a));
    const enc = spawnSync("cast", ["abi-encode", sig, ...real], { env, encoding: "utf8" }).stdout.trim();
    cmd.push("--constructor-args", enc);
  }
  const r = spawnSync("forge", cmd, { env, encoding: "utf8", shell: process.platform === "win32" });
  const out = (r.stdout + r.stderr).trim().split("\n").slice(-2).join(" ").slice(0, 160);
  const ok = r.status === 0;
  if (!ok) bad++;
  console.log(`${ok ? "verified" : "FAILED  "} ${name} ${dep[name].address} ${out}`);
}
process.exit(bad ? 1 : 0);
