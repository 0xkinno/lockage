// One command after funding: deploy, seal and pair the demo tokens, run the drift experiment,
// verify the envelope, sweep the keeper, measure the challenge window, regenerate FACTS and the README.
import { spawnSync } from "node:child_process";
const steps = [
  ["balances", ["npx", "tsx", "scripts/balances.ts"]],
  ["build contracts and ABIs", ["node", "scripts/forge.mjs", "build"]],
  ["generate ABIs", ["node", "scripts/gen-abi.mjs"]],
  ["deploy", ["npx", "tsx", "scripts/deploy.ts"]],
  ["seal and pair demo tokens", ["npx", "tsx", "scripts/setup-demo.ts"]],
  ["drift experiment and counterfactual", ["npx", "tsx", "scripts/experiment-drift.ts"]],
  ["verify envelope against HyperCore", ["npx", "tsx", "scripts/verify-envelope.ts"]],
  ["lockkeeper sweep", ["npx", "tsx", "scripts/lockkeeper.ts"]],
  ["measure challenge window", ["npx", "tsx", "scripts/measure-window.ts"]],
  ["facts", ["npx", "tsx", "scripts/facts.ts"]],
  ["render README", ["npx", "tsx", "scripts/render-readme.ts"]],
];
for (const [name, cmd] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\nStopped at "${name}" (exit ${r.status}). Fix it and run npm run go-live again; finished steps are skipped.`);
    process.exit(r.status ?? 1);
  }
}
console.log("\ngo-live complete");
