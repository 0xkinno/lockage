import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const dep = JSON.parse(readFileSync("data/deployments.json", "utf8")).contracts as Record<string, { address: string }>;

test.describe("embeddable check for Ascend's launch form", () => {
  test("design mode returns the five lines with rules and the RPC note", async ({ request }) => {
    const r = await request.get("/api/survey?decimals=18&supply=1000000000000&rename=1&mint=1&tax=0");
    expect(r.status()).toBe(200);
    expect(r.headers()["access-control-allow-origin"]).toBe("*");
    expect(r.headers()["cache-control"]).toContain("s-maxage=60");
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.mode).toBe("design");
    expect(j.lines).toHaveLength(5);
    for (const l of j.lines) expect(l.rule).toBeTruthy();
    expect(j.overall).toBe("block");
    expect(j.blocks).toBe(2);
    expect(j.envelope.weiDecimals).toBe(7);
    expect(j.rpc).toBeNull(); // no chain read was needed, and the response says so
  });

  test("rejects bad input with a plain error", async ({ request }) => {
    expect((await request.get("/api/survey")).status()).toBe(400);
    expect((await request.get("/api/survey?decimals=999&supply=1")).status()).toBe(400);
    expect((await request.get("/api/survey?decimals=18&supply=abc")).status()).toBe(400);
    expect((await request.get("/api/survey?address=0x123")).status()).toBe(400);
  });

  test("address mode reads the chain and names the RPC that answered", async ({ request }) => {
    const r = await request.get(`/api/survey?address=${dep.SealedToken.address}`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.mode).toBe("address");
    expect(j.token.symbol).toBe("LSEAL");
    expect(j.rpc.answeredBy).toContain("kinetiq");
    expect(["hit", "miss"]).toContain(r.headers()["x-lockage-cache"]);
  });

  test("an upgradeable proxy is reported as identity that can change by upgrade", async ({ request }) => {
    // the public RPC can blip: the API says so with a 5xx, so retry a few times
    let j: { ok: boolean; lines?: { id: string; verdict: string; detail: string }[] } = { ok: false };
    for (let i = 0; i < 4 && !j.ok; i++) {
      const r = await request.get(`/api/survey?address=${dep.UpgradeToken.address}`);
      j = await r.json();
      if (!j.ok) await new Promise((x) => setTimeout(x, 1500));
    }
    const meta = j.lines!.find((l) => l.id === "metadata")!;
    expect(meta.verdict).toBe("block");
    expect(meta.detail).toContain("Identity can change by upgrade");
  });

  test("/embed renders a 360px card without the site chrome", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/embed?decimals=18&supply=1000000000000&rename=1", { waitUntil: "networkidle" });
    const card = page.getByTestId("embed");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("embed-headline")).toContainText("block");
    await expect(page.locator("[data-line]")).toHaveCount(5);
    const box = await card.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(361);
    await expect(page.locator("header")).toBeHidden();
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(sw).toBeTruthy();
  });
});
