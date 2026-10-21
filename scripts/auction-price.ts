/**
 * The money figure: what buying a HyperCore spot ticker costs, read from the chain's own auction state.
 * Reads {"type":"spotDeployState","user":<deployer>} from the Hyperliquid info API on mainnet and testnet and saves a dated
 * snapshot to data/auction-<date>.json. docs/FACTS.json reads the latest snapshot, and tests/auction.test.ts asserts the README figure.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { today } from "./_env";

const user = JSON.parse(readFileSync("data/wallets.json", "utf8")).deployer as string;
const APIS = { mainnet: "https://api.hyperliquid.xyz/info", testnet: "https://api.hyperliquid-testnet.xyz/info" } as const;

type Gas = { startTimeSeconds: number; durationSeconds: number; startGas: string; currentGas: string | null; endGas: string | null };
const out: Record<string, unknown> = { ranOn: today(), user, readAt: new Date().toISOString(), source: "info API spotDeployState" };
for (const [net, url] of Object.entries(APIS)) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "spotDeployState", user }) });
    const j = (await r.json()) as { gasAuction?: Gas; states?: unknown[] };
    const g = j.gasAuction;
    out[net] = g
      ? { startGasHype: g.startGas, currentGasHype: g.currentGas, endGasHype: g.endGas, startTimeSeconds: g.startTimeSeconds, durationSeconds: g.durationSeconds, tickerPriceHype: g.currentGas ?? g.startGas }
      : { error: "no gasAuction field in the response", keys: Object.keys(j) };
  } catch (e) {
    out[net] = { error: String((e as Error).message).slice(0, 120) };
  }
}
writeFileSync(`data/auction-${today()}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
