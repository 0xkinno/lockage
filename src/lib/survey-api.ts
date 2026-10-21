import { runSurvey, type Survey } from "./survey";
import { maxWholeSupply } from "./envelope";
import { NotAnErc20, parseAddress, readToken } from "./chain-read";
import { ELYSIUM_RPC } from "./chains";

/**
 * The embeddable check Ascend can drop into its launch form. Two modes, one result shape:
 *   ?address=0x...                                    a deployed Elysium testnet token, read from the chain
 *   ?decimals=18&supply=1000000000000&rename=1&mint=0&tax=0    a token that does not exist yet (the launch-form case)
 */
export type SurveyResponse = {
  ok: true;
  mode: "address" | "design";
  input: Record<string, string | number | boolean>;
  token?: { address: string; name: string; symbol: string; decimals: number; totalSupply: string; proxyAdmin: string | null };
  overall: Survey["overall"];
  blocks: number;
  unknowns: number;
  envelope: { graduates: boolean; weiDecimals: number; maxSzDecimals: number; evmExtraWeiDecimals: number; depositMultipleBaseUnits: string; maxWholeSupplyAtThisDecimals: string };
  lines: { id: string; title: string; verdict: string; detail: string; rule: string; fix?: string }[];
  rpc: { answeredBy: string; chain: string } | null;
  generatedAt: string;
  cacheSeconds: 60;
};
export type SurveyError = { ok: false; error: string; status: number };

const flag = (v: string | null) => v === "1" || v === "true" || v === "yes";

export async function surveyFromParams(p: URLSearchParams): Promise<SurveyResponse | SurveyError> {
  const address = p.get("address");
  const generatedAt = new Date().toISOString();
  const host = new URL(ELYSIUM_RPC).host;

  if (address) {
    const a = parseAddress(address);
    if (!a) return { ok: false, error: "address is not a valid 0x address", status: 400 };
    try {
      const info = await readToken(a);
      const s = runSurvey({ decimals: info.decimals, supplyBase: info.totalSupply, scan: info.scan });
      return build("address", { address: a }, s, info.decimals, generatedAt, host, {
        address: a,
        name: info.name,
        symbol: info.symbol,
        decimals: info.decimals,
        totalSupply: info.totalSupply.toString(),
        proxyAdmin: info.scan.proxyAdmin ?? null,
      });
    } catch (e) {
      if (e instanceof NotAnErc20) return { ok: false, error: e.message, status: 422 };
      return { ok: false, error: "the Elysium testnet RPC did not answer: " + (e as Error).message.split("\n")[0].slice(0, 120), status: 502 };
    }
  }

  const dec = p.get("decimals");
  const sup = p.get("supply");
  if (dec === null || sup === null) return { ok: false, error: "pass ?address=0x... or ?decimals=18&supply=1000000000000 (whole tokens), optionally rename, mint, tax as 0 or 1", status: 400 };
  if (!/^\d{1,3}$/.test(dec) || Number(dec) > 255) return { ok: false, error: "decimals must be an integer from 0 to 255", status: 400 };
  const cleaned = sup.replace(/[,_\s]/g, "");
  if (!/^\d{1,40}$/.test(cleaned)) return { ok: false, error: "supply must be a whole number of tokens, up to 40 digits", status: 400 };
  const d = Number(dec);
  const design = { rename: flag(p.get("rename")), mint: flag(p.get("mint")), tax: flag(p.get("tax")) };
  const s = runSurvey({ decimals: d, supplyBase: BigInt(cleaned) * 10n ** BigInt(d), design });
  return build("design", { decimals: d, supply: cleaned, ...design }, s, d, generatedAt, host, undefined, false);
}

function build(mode: "address" | "design", input: SurveyResponse["input"], s: Survey, d: number, generatedAt: string, host: string, token?: SurveyResponse["token"], usedRpc = true): SurveyResponse {
  return {
    ok: true,
    mode,
    input,
    token,
    overall: s.overall,
    blocks: s.blocks,
    unknowns: s.unknowns,
    envelope: {
      graduates: s.env.graduates,
      weiDecimals: s.env.bestWei,
      maxSzDecimals: s.env.maxSz,
      evmExtraWeiDecimals: s.env.evmExtra,
      depositMultipleBaseUnits: s.env.alignUnit.toString(),
      maxWholeSupplyAtThisDecimals: maxWholeSupply(d).toString(),
    },
    lines: s.lines.map((l) => ({ id: l.id, title: l.title, verdict: l.verdict, detail: l.detail, rule: l.rule, ...(l.fix ? { fix: l.fix } : {}) })),
    rpc: usedRpc ? { answeredBy: host, chain: "Elysium testnet 99801" } : null,
    generatedAt,
    cacheSeconds: 60,
  };
}

/** 60 second in-memory cache and a per-IP sliding window limit. Per server instance, which is enough for a read endpoint. */
const cache = new Map<string, { at: number; body: SurveyResponse | SurveyError }>();
const hits = new Map<string, number[]>();
export const RATE_LIMIT = { perMinute: 30 };

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const k of hits.keys()) if (!(hits.get(k) ?? []).some((t) => now - t < 60_000)) hits.delete(k);
  return recent.length > RATE_LIMIT.perMinute;
}

export async function cachedSurvey(p: URLSearchParams): Promise<{ body: SurveyResponse | SurveyError; cached: boolean }> {
  const key = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return { body: hit.body, cached: true };
  const body = await surveyFromParams(p);
  if (body.ok || body.status < 500) cache.set(key, { at: Date.now(), body });
  if (cache.size > 500) cache.clear();
  return { body, cached: false };
}
