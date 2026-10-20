// Landscape, viewport-sized screenshots for the README (not full-page captures).
// Usage: node scripts/readme-shots.mjs [baseUrl]
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".tools/pw");
const { chromium } = await import("@playwright/test");

const base = process.argv[2] ?? "http://localhost:3107";
const dep = JSON.parse(readFileSync("data/deployments.json", "utf8")).contracts;
mkdirSync("docs/screenshots", { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const out = (n) => `docs/screenshots/${n}.png`;
const settle = async (ms = 900) => {
  await p.evaluate(() => (document.documentElement.style.scrollBehavior = "auto"));
  await p.waitForTimeout(ms);
};
const scrollTo = async (y) => {
  await p.evaluate((yy) => window.scrollTo(0, yy), y);
  await p.waitForTimeout(700);
};
// bring an element to just under the floating nav, so no heading is cut behind it
const focusOn = async (sel, offset = 120) => {
  await p.evaluate(([q, o]) => { const e = document.querySelector(q); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - o); }, [sel, offset]);
  await p.waitForTimeout(800);
};

// banner: the landing hero as a visitor first sees it
await p.goto(base + "/", { waitUntil: "networkidle" });
await settle(1200);
await p.screenshot({ path: out("banner") });

// the ladder and five checks, mid-scroll
await scrollTo(1020);
await p.waitForTimeout(900);
await p.screenshot({ path: out("ladder") });

// from here on the pages are scrolled: put a solid paper band behind the floating nav so no text shows through it
const mask = () => p.addStyleTag({ content: "body::after{content:'';position:fixed;top:0;left:0;right:0;height:92px;background:linear-gradient(var(--paper) 80%, transparent);z-index:45;pointer-events:none}" });

// survey: Ines at 23:10
await p.goto(base + "/survey", { waitUntil: "networkidle" });
await mask();
await p.getByTestId("preset-ines").click();
await settle(600);
await focusOn('[data-testid="survey-headline"]', 130);
await p.screenshot({ path: out("survey") });

// cross: live pre-flight for the sealed token
await p.goto(base + "/cross", { waitUntil: "networkidle" });
await mask();
await p.getByTestId("pick-sealed").click();
await p.getByTestId("preflight").waitFor({ timeout: 30000 });
await settle(800);
await focusOn('[data-testid="preflight"]', 150);
await p.screenshot({ path: out("cross") });

// cross: the refusal on the renamed token
await p.getByTestId("pick-drift").click();
await p.locator('[data-check="identity"][data-ok="false"]').waitFor({ timeout: 30000 });
await settle(800);
await focusOn('[data-testid="preflight"]', 150);
await p.screenshot({ path: out("cross-refusal") });

// keeper: live reconcile
await p.goto(base + "/keeper", { waitUntil: "networkidle" });
await mask();
await p.getByTestId("sweep-now").click();
await p.getByTestId("keeper-row").first().waitFor({ timeout: 90000 });
await p.getByRole("button", { name: "Reconcile live now" }).waitFor({ timeout: 90000 });
await settle(800);
await focusOn('[data-testid="sweeps"]', 190);
await p.screenshot({ path: out("keeper") });

// proof: contracts
await p.goto(base + "/proof", { waitUntil: "networkidle" });
await mask();
await settle(800);
await focusOn('[data-testid="contracts-table"]', 160);
await p.screenshot({ path: out("proof") });

// certificate
await p.goto(`${base}/certificate/${dep.SealedToken.address}`, { waitUntil: "networkidle" });
await mask();
await p.getByTestId("certificate").waitFor({ timeout: 30000 });
await settle(900);
await focusOn('[data-testid="certificate"]', 90);
await p.screenshot({ path: out("certificate") });

// census
await p.goto(base + "/census", { waitUntil: "networkidle" });
await mask();
await settle(900);
await focusOn('[data-testid="census-tiles"]', 130);
await p.screenshot({ path: out("census") });

await b.close();
console.log("README screenshots written to docs/screenshots/");
