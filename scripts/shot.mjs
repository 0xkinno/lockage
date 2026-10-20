// Quick screenshot helper: node scripts/shot.mjs <path> <width> <height> <out> [fullPage]
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".tools/pw");
const { chromium } = await import("@playwright/test");
const [, , path = "/", w = "1440", h = "900", out = "shot.png", full = "1"] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
p.on("pageerror", (e) => errs.push("pageerror " + e.message.slice(0, 200)));
await p.goto("http://localhost:3107" + path, { waitUntil: "networkidle", timeout: 90000 });
await p.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
await p.waitForTimeout(900);
await p.screenshot({ path: out, fullPage: full === "1" });
console.log("saved", out, "errors:", errs.length, errs.slice(0, 5));
await b.close();
