import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

// The README figure for the ticker auction must match the dated snapshot it was rendered from.
test("README ticker price matches the latest auction snapshot", () => {
  const files = readdirSync("data").filter((f) => /^auction-.*\.json$/.test(f)).sort();
  assert.ok(files.length > 0, "run npm run auction first");
  const snap = JSON.parse(readFileSync(`data/${files[files.length - 1]}`, "utf8"));
  const price = Number(snap.mainnet.tickerPriceHype);
  assert.ok(price > 0, "snapshot has a mainnet ticker price");
  const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
  const shown = price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  assert.ok(readme.includes(`${shown} HYPE`), `README should state ${shown} HYPE`);
  assert.ok(readme.includes(snap.ranOn), `README should carry the snapshot date ${snap.ranOn}`);
});
