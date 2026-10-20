import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1366, height: 900 } });

test.describe("survey, design mode (no wallet)", () => {
  test("Ines at 23:10 blocks on identity and growth, supply passes at wei 7", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("preset-ines").click();
    const lines = page.locator("[data-line]");
    await expect(lines).toHaveCount(5);
    await expect(page.locator('[data-line="supply"]')).toHaveAttribute("data-verdict", "pass");
    await expect(page.locator('[data-line="supply"]')).toContainText("7 wei decimals");
    await expect(page.locator('[data-line="metadata"]')).toHaveAttribute("data-verdict", "block");
    await expect(page.locator('[data-line="growth"]')).toHaveAttribute("data-verdict", "block");
    await expect(page.getByTestId("survey-headline")).toContainText("2 lines block graduation");
  });

  test("Fixed and locked passes every line", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("preset-fixed").click();
    for (const id of ["supply", "decimals", "metadata", "growth", "transfer"]) await expect(page.locator(`[data-line="${id}"]`)).toHaveAttribute("data-verdict", "pass");
    await expect(page.getByTestId("survey-result")).toHaveAttribute("data-overall", "pass");
    await expect(page.locator('[data-line="supply"]')).toContainText("8 wei decimals");
  });

  test("an oversize supply blocks supply fit with the rule cited and a fix", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("in-supply").fill("1,000,000,000,000,000");
    const line = page.locator('[data-line="supply"]');
    await expect(line).toHaveAttribute("data-verdict", "block");
    await expect(line).toContainText("uint64");
    await expect(line).toContainText("166,020,696,663,385");
  });

  test("transfer tax toggle blocks the transfer line", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("preset-fixed").click();
    await page.getByTestId("toggle-tax").click();
    await expect(page.locator('[data-line="transfer"]')).toHaveAttribute("data-verdict", "block");
  });

  test("bad decimals get a plain instruction, not a crash", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("in-decimals").fill("abc");
    await expect(page.getByRole("status")).toContainText("Enter decimals");
  });

  test("decimals above 26 cannot graduate", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("in-decimals").fill("30");
    await page.getByTestId("in-supply").fill("1000");
    await expect(page.locator('[data-line="decimals"]')).toHaveAttribute("data-verdict", "block");
  });
});

test.describe("survey, address mode reads the real chain", () => {
  test("rejects a malformed address", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("tab-address").click();
    await page.getByTestId("in-address").fill("0x123");
    await page.getByTestId("run-survey").click();
    await expect(page.locator("main [role=alert]")).toContainText("not a valid address");
  });

  test("an EOA is not a token", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("tab-address").click();
    await page.getByTestId("in-address").fill("0x000000000000000000000000000000000000dEaD");
    await page.getByTestId("run-survey").click();
    await expect(page.locator("main [role=alert]")).toContainText(/No contract/);
  });

  test("a live Elysium testnet token is surveyed from chain data", async ({ page }) => {
    await page.goto("/survey");
    await page.getByTestId("tab-address").click();
    // USDC on Elysium testnet from the published address list
    await page.getByTestId("in-address").fill("0x7D29d8047B905000459c0E80c34a26CeedcB47b2");
    await page.getByTestId("run-survey").click();
    await expect(page.getByTestId("survey-result")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-line]")).toHaveCount(5);
    await expect(page.getByText("decimals", { exact: false }).first()).toBeVisible();
  });

  test("?token= deep link opens address mode and surveys", async ({ page }) => {
    await page.goto("/survey?token=0x7D29d8047B905000459c0E80c34a26CeedcB47b2");
    await expect(page.getByTestId("tab-address")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("survey-result")).toBeVisible({ timeout: 30_000 });
  });
});

test("status API reports both chains and says which source answered", async ({ request }) => {
  let j: { rpc: { chainId: number; ok: boolean; source: string }[] } | null = null;
  // a slow public RPC is reported honestly by the API (ok: false), so retry a few times
  for (let i = 0; i < 4; i++) {
    const r = await request.get("/api/status");
    expect(r.ok()).toBeTruthy();
    j = await r.json();
    if (j!.rpc.every((x) => x.ok)) break;
  }
  expect(j!.rpc).toHaveLength(2);
  expect(j!.rpc.map((x) => x.chainId).sort()).toEqual([998, 99801]);
  expect(j!.rpc.every((x) => x.ok && x.source)).toBeTruthy();
});
