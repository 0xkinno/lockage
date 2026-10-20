import { writeFileSync } from "node:fs";
import { envelope } from "../src/lib/envelope";

// Deterministic PRNG (mulberry32) so the vector file is reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(99801);
const dec = (v: bigint) => v.toString(10);
function randBig(bits: number): bigint {
  let v = 0n;
  for (let i = 0; i < bits; i += 32) v = (v << 32n) | BigInt(Math.floor(r() * 4294967296));
  return v & ((1n << BigInt(bits)) - 1n);
}

const cols: Record<string, (string | boolean)[]> = { alignUnit: [], bestWei: [], coreSupplyWei: [], d: [], graduates: [], supply: [] };
const decimalsPool = [0, 1, 2, 5, 6, 8, 9, 12, 16, 18, 18, 18, 18, 19, 20, 24, 26, 27, 30, 36, 77, 255];
for (let i = 0; i < 10000; i++) {
  const d = i < 256 ? i : decimalsPool[Math.floor(r() * decimalsPool.length)];
  let s: bigint;
  const mode = Math.floor(r() * 5);
  if (mode === 0) s = randBig(Math.floor(r() * 256) + 1);
  else if (mode === 1) s = BigInt(Math.floor(r() * 1e12) + 1) * 10n ** BigInt(Math.min(d, 40));
  else if (mode === 2) s = BigInt(Math.floor(r() * 1e9) + 1) * 10n ** BigInt(Math.max(0, d - Math.floor(r() * 12)));
  else if (mode === 3) s = r() < 0.05 ? 0n : BigInt(Math.floor(r() * 1e15));
  else s = 10n ** BigInt(Math.floor(r() * 40)) * (r() < 0.5 ? 1n : 5n);
  s = s % (1n << 256n);
  const e = envelope(d, s);
  cols.alignUnit.push(dec(e.alignUnit));
  cols.bestWei.push(dec(BigInt(e.bestWei)));
  cols.coreSupplyWei.push(dec(e.coreSupplyWei));
  cols.d.push(dec(BigInt(d)));
  cols.graduates.push(e.graduates);
  cols.supply.push(dec(s));
}
writeFileSync("data/envelope-vectors.json", JSON.stringify({ count: cols.d.length, ...cols }));
console.log("wrote", cols.d.length, "vectors;", cols.graduates.filter(Boolean).length, "graduate");
