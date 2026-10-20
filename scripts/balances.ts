import { formatEther } from "viem";
import { account, ely, he } from "./_env";

const NEED: Record<string, { ely: number; he: number; why: string }> = {
  DEPLOYER_PK: { ely: 0.5, he: 0.05, why: "deploys contracts, seals, runs the drift experiment, pays mirror registration on HyperEVM" },
  BUILDER_PK: { ely: 0.1, he: 0, why: "plays Ines in the end-to-end test: seals a token, acknowledges a finding" },
  HOLDER_PK: { ely: 0.1, he: 0, why: "plays Rahul in the end-to-end test: approves and crosses through LockGate" },
  KEEPER_PK: { ely: 0, he: 0, why: "read-only, needs nothing" },
};

let ok = true;
for (const k of Object.keys(NEED) as (keyof typeof NEED)[]) {
  const a = account(k as "DEPLOYER_PK");
  const [e, h] = await Promise.all([ely.getBalance({ address: a.address }), he.getBalance({ address: a.address })]);
  const needE = NEED[k].ely;
  const needH = NEED[k].he;
  const good = Number(formatEther(e)) >= needE && Number(formatEther(h)) >= needH;
  if (!good) ok = false;
  console.log(`${good ? "OK  " : "LOW "} ${k.replace("_PK", "").padEnd(9)} ${a.address}  Elysium ${formatEther(e).padStart(10)} (need ${needE})  HyperEVM ${formatEther(h).padStart(10)} (need ${needH})`);
}
console.log(ok ? "\nAll wallets funded." : "\nTop up the LOW wallets. Steps: docs/WALLETS.md");
process.exit(ok ? 0 : 3);
