/** Writes data/pairs.json: for every demo token, its canonical mirror, escrow wallet and router route, read from chain. */
import { readFileSync, writeFileSync } from "node:fs";
import { ely, he, today } from "./_env";
import { ADDR } from "../src/lib/chains";
import { mirrorOf, walletOf, gatewayOf } from "./_bridge";
import { erc20Abi } from "../src/lib/abi";
import type { Address } from "viem";

const dep = JSON.parse(readFileSync("data/deployments.json", "utf8")).contracts as Record<string, { address: Address }>;
const rows = [];
for (const name of ["SealedToken", "DriftToken", "TaxToken", "MintToken", "OversizeToken", "UpgradeToken"]) {
  const token = dep[name].address;
  const [symbol, mirror, wallet] = await Promise.all([ely.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }), mirrorOf(token), walletOf(token)]);
  const gw = await gatewayOf(mirror);
  const code = await he.getCode({ address: mirror });
  rows.push({
    contract: name,
    symbol,
    token,
    mirror,
    wallet: wallet === "0x0000000000000000000000000000000000000000" ? null : wallet,
    routed: !!gw && gw.toLowerCase() === ADDR.elysium.walletGateway.toLowerCase(),
    mirrorDeployed: !!code && code !== "0x",
  });
}
writeFileSync("data/pairs.json", JSON.stringify({ ranOn: today(), rows }, null, 2));
console.log(rows.map((r) => `${r.symbol} mirror ${r.mirror} wallet ${r.wallet} routed ${r.routed}`).join("\n"));
