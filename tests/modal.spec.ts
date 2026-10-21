import { generatePrivateKey } from "viem/accounts";
import { expect, test } from "@playwright/test";
import { installWallet } from "./helpers/mockWallet";

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-15-pro", width: 393, height: 852 },
  { name: "pixel-7", width: 412, height: 915 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`wallet modal is full size, centred and inside the viewport at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await installWallet(page, generatePrivateKey(), { name: "Rabby Wallet" });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    const dialog = page.getByTestId("wallet-modal");
    await expect(dialog).toBeVisible();
    // the dialog must be a direct child of body (not trapped inside the blurred nav capsule)
    expect(await dialog.evaluate((e) => e.parentElement === document.body)).toBe(true);
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.round(box.height)).toBe(vp.height);
    const card = dialog.locator(".plate").first();
    const cb = (await card.boundingBox())!;
    expect(cb.width).toBeGreaterThanOrEqual(Math.min(420, vp.width - 32) - 2);
    expect(cb.width).toBeLessThanOrEqual(421);
    expect(cb.x).toBeGreaterThanOrEqual(0);
    expect(cb.x + cb.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(Math.abs(cb.x + cb.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
    expect(cb.y + cb.height).toBeLessThanOrEqual(vp.height + 0.5);
    // the wallet row reads horizontally: icon, name on one line
    const row = dialog.getByRole("button", { name: /Rabby Wallet/ });
    const rb = (await row.boundingBox())!;
    expect(rb.width).toBeGreaterThan(200);
    expect(rb.height).toBeLessThan(80);
    await page.screenshot({ path: `test-results/shots/modal-${vp.name}.png` });
  });
}
