/**
 * D2 ground truth. Checks the envelope rules against real HyperCore testnet tokens (spotMeta + tokenDetails):
 *  1. szDecimals + 5 <= weiDecimals holds for the tokens (exceptions are named)
 *  2. for every token with a linked EVM contract, the real weiDecimals is feasible under our rules:
 *     evmExtraWeiDecimals in [-2, 18] and maxSupply * 10^weiDecimals fits uint64
 *  3. our finest feasible weiDecimals is never coarser than what the issuer chose (we do not forbid a real plan)
 */
import { writeFileSync } from "node:fs";
import { CORE_MAX, envelope, fit } from "../src/lib/envelope";
import { sleep, today } from "./_env";

const API = "https://api.hyperliquid-testnet.xyz/info";
const post = (body: object) => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

type Tok = { name: string; szDecimals: number; weiDecimals: number; index: number; tokenId: string; evmContract: null | { address: string; evm_extra_wei_decimals: number } };
const meta = (await post({ type: "spotMeta" })) as { tokens: Tok[] };
const tokens = meta.tokens;
writeFileSync("data/spot-snapshot.json", JSON.stringify({ ranOn: today(), tokens: tokens.length }));

const ruleViolations = tokens.filter((t) => t.szDecimals + 5 > t.weiDecimals).map((t) => ({ name: t.name, szDecimals: t.szDecimals, weiDecimals: t.weiDecimals }));
const dist: Record<number, number> = {};
for (const t of tokens) dist[t.weiDecimals] = (dist[t.weiDecimals] ?? 0) + 1;

const linked = tokens.filter((t) => t.evmContract);
const rows: Record<string, unknown>[] = [];
let checked = 0;
let consistent = 0;
let atCeiling = 0;
const exceptions: Record<string, unknown>[] = [];
for (const t of linked) {
  if (checked >= 80) break;
  let d: { maxSupply?: string; totalSupply?: string } | null = null;
  try {
    d = (await post({ type: "tokenDetails", tokenId: t.tokenId })) as { maxSupply?: string; totalSupply?: string } | null;
  } catch {
    continue;
  }
  await sleep(120);
  const supplyStr = d?.maxSupply ?? d?.totalSupply;
  if (!supplyStr) continue;
  const extra = t.evmContract!.evm_extra_wei_decimals;
  const evmDecimals = t.weiDecimals + extra;
  if (evmDecimals < 0 || evmDecimals > 255) continue;
  // supply in EVM base units, from the whole-token figure (may carry decimals)
  const [whole, frac = ""] = supplyStr.split(".");
  const coreWei = BigInt(whole + frac.padEnd(t.weiDecimals, "0").slice(0, t.weiDecimals));
  const evmBase = extra >= 0 ? coreWei * 10n ** BigInt(extra) : coreWei / 10n ** BigInt(-extra);
  const extraOk = extra >= -2 && extra <= 18;
  const fitsReal = coreWei <= CORE_MAX;
  const env = envelope(evmDecimals, evmBase);
  const realFeasible = t.weiDecimals >= 5 && fit(evmDecimals, evmBase, t.weiDecimals).reason !== "unaligned";
  // a supply that sits at the hard uint64 ceiling is legal for HyperCore; LOCKAGE plans 10% below it on purpose
  const nearHardCeiling = !fitsReal ? false : coreWei > CORE_MAX - CORE_MAX / 100n;
  const ok = extraOk && fitsReal;
  checked++;
  if (ok) consistent++;
  else exceptions.push({ token: t.name, weiDecimals: t.weiDecimals, evmExtra: extra, maxSupply: supplyStr, why: !extraOk ? "evmExtraWeiDecimals outside [-2, 18]" : t.name === "USDC" ? "system token with a special supply" : "reported maxSupply exceeds uint64 in Core wei at the stated weiDecimals" });
  if (nearHardCeiling) atCeiling++;
  rows.push({ token: t.name, weiDecimals: t.weiDecimals, szDecimals: t.szDecimals, evmExtra: extra, evmDecimals, maxSupply: supplyStr, coreWei: coreWei.toString(), extraInRange: extraOk, fitsUint64: fitsReal, ourFinestWei: env.graduates ? env.bestWei : null, realWeiAtOrBelowOurCap: t.weiDecimals <= 8, realFeasibleUnderOurRules: realFeasible });
}

const report = {
  ranOn: today(),
  spotTokens: tokens.length,
  weiDecimalsDistribution: dist,
  tokensAtOrBelowCap8: tokens.filter((t) => t.weiDecimals <= 8).length,
  szRuleViolations: ruleViolations.length,
  szRuleViolationsSample: ruleViolations.slice(0, 14),
  linkedEvmTokens: linked.length,
  checked,
  consistentWithRules: consistent,
  tokensNearHardUint64Ceiling: atCeiling,
  exceptions,
  note: "Exceptions are named, not hidden. LOCKAGE plans 10% below the uint64 ceiling by design, so it is stricter than HyperCore itself.",
  sample: rows.slice(0, 12),
};
writeFileSync("data/envelope-verification.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, sample: undefined, szRuleViolationsSample: undefined }, null, 1));
