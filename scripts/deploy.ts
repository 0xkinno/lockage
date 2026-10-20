/**
 * Deploys LOCKAGE to Elysium testnet (99801) with the DEPLOYER_PK wallet. Idempotent: skips what is in
 * data/deployments.json. Records address, tx hash, gas used and fee per contract (cost per unit, no typing).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { encodeDeployData, formatEther, type Abi, type Hex } from "viem";
import { ely, walletFor, account, today } from "./_env";
import * as ABI from "../src/lib/abi";
import { ADDR } from "../src/lib/chains";

const FILE = "data/deployments.json";
type Dep = { address: string; txHash: string; gasUsed: string; feeWei: string; block: number; deployedOn: string };
type Book = { chainId: number; deployer: string; contracts: Record<string, Dep> };

const artifacts: Record<string, Hex> = JSON.parse(readFileSync("data/artifacts.json", "utf8"));
const book: Book = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, "utf8"))
  : { chainId: 99801, deployer: account("DEPLOYER_PK").address, contracts: {} };

const wallet = walletFor("DEPLOYER_PK", "ely");

async function deploy(name: string, abi: Abi, args: unknown[] = []) {
  if (book.contracts[name]) {
    console.log("skip", name, book.contracts[name].address);
    return book.contracts[name].address as `0x${string}`;
  }
  const data = encodeDeployData({ abi, bytecode: artifacts[name], args: args as never });
  const hash = await wallet.sendTransaction({ data, chain: wallet.chain, account: wallet.account });
  const rc = await ely.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (rc.status !== "success" || !rc.contractAddress) throw new Error(`${name} deploy failed ${hash}`);
  book.contracts[name] = {
    address: rc.contractAddress,
    txHash: hash,
    gasUsed: rc.gasUsed.toString(),
    feeWei: (rc.gasUsed * rc.effectiveGasPrice).toString(),
    block: Number(rc.blockNumber),
    deployedOn: today(),
  };
  writeFileSync(FILE, JSON.stringify(book, null, 2));
  console.log("deployed", name, rc.contractAddress, "gas", rc.gasUsed.toString(), "fee", formatEther(rc.gasUsed * rc.effectiveGasPrice), "HYPE");
  return rc.contractAddress;
}

const bal = await ely.getBalance({ address: wallet.account.address });
console.log("deployer", wallet.account.address, "balance", formatEther(bal), "HYPE");
if (bal < 10n ** 16n) {
  console.error("Deployer needs Elysium testnet HYPE first. See docs/WALLETS.md for the faucet steps.");
  process.exit(2);
}

const survey = await deploy("LockSurvey", ABI.lockSurveyAbi as Abi, [ADDR.elysium.bridgeFactory]);
const ledger = await deploy("LockLedger", ABI.lockLedgerAbi as Abi, [survey]);
await deploy("LockGate", ABI.lockGateAbi as Abi, [survey, ledger, ADDR.elysium.router, ADDR.elysium.walletGateway]);
await deploy("LockProbe", ABI.lockProbeAbi as Abi);
for (const t of ["SealedToken", "DriftToken", "OversizeToken", "TaxToken", "MintToken"]) {
  await deploy(t, (ABI as Record<string, unknown>)[t[0].toLowerCase() + t.slice(1) + "Abi"] as Abi);
}
console.log("done. addresses in", FILE);
