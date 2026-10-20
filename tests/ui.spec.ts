import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-15-pro", width: 393, height: 852 },
  { name: "pixel-7", width: 412, height: 915 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];
const ROUTES = [
  { path: "/", slug: "landing" },
  { path: "/survey", slug: "survey" },
  { path: "/cross", slug: "cross" },
  { path: "/keeper", slug: "keeper" },
  { path: "/census", slug: "census" },
  { path: "/proof", slug: "proof" },
  { path: "/judge", slug: "judge" },
];
const NAV_ROUTE = new Set(["/survey", "/cross", "/keeper", "/census", "/proof", "/judge"]);

mkdirSync("docs/screenshots", { recursive: true });

async function settle(page: Page) {
  await page.goto("about:blank");
}
void settle;

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const r of ROUTES) {
      test(`${r.path}: layout, fonts, overlap, console, a11y`, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
        page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300)));
        await page.goto(r.path, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);

        // 1. no horizontal scroll
        const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(dims.sw, `horizontal scroll on ${r.path} at ${vp.width}`).toBeLessThanOrEqual(dims.cw);

        // 2. fonts: display serif on the h1, Geist on the body, Geist Mono on labels
        const fonts = await page.evaluate(() => {
          const fam = (sel: string) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el).fontFamily : "";
          };
          const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""));
          return { h1: fam("h1"), body: fam("body"), label: fam(".label"), loaded };
        });
        expect(fonts.h1).toMatch(/Instrument/i);
        expect(fonts.body).toMatch(/Geist/i);
        expect(fonts.label).toMatch(/Geist/i);
        expect(fonts.loaded.some((f) => /Instrument/i.test(f))).toBeTruthy();
        expect(fonts.loaded.some((f) => /Geist/i.test(f))).toBeTruthy();

        // 3. nothing overlaps the H1 or the primary buttons
        const overlaps = await page.evaluate(() => {
          const rect = (e: Element) => e.getBoundingClientRect();
          const h1 = document.querySelector("h1");
          if (!h1) return ["no h1"];
          const out: string[] = [];
          const hr = rect(h1);
          const header = document.querySelector("header");
          if (header) {
            for (const e of header.querySelectorAll("a,button,nav")) {
              const er = rect(e);
              if (er.width && er.left < hr.right - 1 && er.right > hr.left + 1 && er.top < hr.bottom - 1 && er.bottom > hr.top + 1) out.push("header item overlaps h1: " + (e.textContent ?? "").slice(0, 20));
            }
          }
          const plate = document.querySelector('[data-testid="hero-plate"]');
          if (plate) {
            const pr = rect(plate);
            const targets = [h1, ...document.querySelectorAll("main .btn, main section:first-of-type p")];
            for (const t of targets) {
              const tr = rect(t);
              if (tr.width && pr.left < tr.right - 1 && pr.right > tr.left + 1 && pr.top < tr.bottom - 1 && pr.bottom > tr.top + 1) out.push("hero plate overlaps " + (t.textContent ?? "").slice(0, 24));
            }
          }
          for (const s of document.querySelectorAll("main svg")) {
            const sr = rect(s);
            if (sr.width && !s.closest("[data-testid=hero-plate]") && sr.left < hr.right - 1 && sr.right > hr.left + 1 && sr.top < hr.bottom - 1 && sr.bottom > hr.top + 1) out.push("svg overlaps h1");
          }
          // text must stay inside the viewport horizontally
          for (const e of document.querySelectorAll("main h1, main h2, main h3, main p, main .btn")) {
            const er = rect(e);
            if (er.width && (er.right > window.innerWidth + 1 || er.left < -1)) out.push("text outside viewport: " + (e.textContent ?? "").slice(0, 24));
          }
          return out;
        });
        expect(overlaps, `overlaps on ${r.path} at ${vp.name}`).toEqual([]);

        // 4. active nav item glow (capsule is desktop-only; the mobile sheet carries the glow)
        if (NAV_ROUTE.has(r.path)) {
          if (vp.width >= 1024) {
            const active = page.locator('[data-testid="nav-capsule"] a[data-active="true"]');
            await expect(active).toHaveCount(1);
            await expect(active).toHaveText(new RegExp(r.slug === "judge" ? "Judges" : r.slug, "i"));
            const glow = await page.locator('[data-testid="nav-active-glow"]').evaluate((e) => getComputedStyle(e).boxShadow);
            expect(glow).not.toBe("none");
            const radius = await page.locator('[data-testid="nav-active-glow"]').evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
            expect(radius).toBeLessThanOrEqual(10); // a square capsule, not a pill
          } else {
            await page.getByTestId("menu-button").click();
            const sheetActive = page.locator('[data-testid="menu-sheet"] a[data-active="true"]');
            await expect(sheetActive).toHaveCount(1);
            await page.keyboard.press("Escape").catch(() => undefined);
          }
        }

        // 5. accessibility, WCAG 2.2 AA
        await scrollThrough(page);
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).disableRules(["color-contrast"]).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`), `axe on ${r.path}`).toEqual([]);
        const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        expect(contrast.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 100)).join(" | ")}`), `contrast on ${r.path}`).toEqual([]);

        // 6. console clean
        expect(errors, `console errors on ${r.path}`).toEqual([]);

        // 7. evidence
        await page.screenshot({ path: `docs/screenshots/${r.slug}-${vp.name}.png`, fullPage: true });
      });
    }
  });
}

test.describe("desktop behaviours", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("plates show the lime glow ring on hover", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 2400));
    const plate = page.locator("article.plate").first();
    await plate.scrollIntoViewIfNeeded();
    await plate.hover();
    await page.waitForTimeout(400);
    const shadow = await plate.evaluate((e) => getComputedStyle(e).boxShadow);
    expect(shadow).toContain("200, 240, 74");
  });

  test("nav glow slides to the new page item on navigation", async ({ page }) => {
    await page.goto("/survey");
    const box1 = await page.locator('[data-testid="nav-active-glow"]').boundingBox();
    await page.locator('[data-testid="nav-capsule"] a', { hasText: "Proof" }).click();
    await page.waitForURL("**/proof");
    await page.waitForTimeout(700);
    const box2 = await page.locator('[data-testid="nav-active-glow"]').boundingBox();
    expect(box1 && box2 && box2.x > box1.x + 100).toBeTruthy();
  });

  test("light paper by default and dark ink toggle", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(246, 247, 236)");
    await page.getByRole("button", { name: /dark ink/i }).click();
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dark).toBe("rgb(15, 17, 10)");
  });

  test("copy rules hold in rendered text", async ({ page }) => {
    for (const p of ["/", "/survey", "/proof", "/judge"]) {
      await page.goto(p);
      const text = await page.evaluate(() => document.body.innerText);
      expect(text, p).not.toMatch(/[—–]/);
      expect(text, p).not.toMatch(/revolutionary|seamless|cutting-edge|world-class|military-grade|zero-trust|nanosecond|paradigm/i);
    }
  });
});
