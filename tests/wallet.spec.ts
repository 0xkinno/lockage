import { readFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { createPublicClient, formatEther, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { expect, test } from "@playwright/test";
import { elysiumTestnet } from "../src/lib/chains";
import { installWallet } from "./helpers/mockWallet";

config({ path: ".env", quiet: true });
test.use({ viewport: { width: 1366, height: 900 } });

const dep = existsSync("data/deployments.json") ? (JSON.parse(readFileSync("data/deployments.json", "utf8")) as { contracts: Record<string, { address: string }> }) : { contracts: {} };
const deployed = !!dep.contracts.LockGate;
const pub = createPublicClient({ chain: elysiumTestnet, transport: http() });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function funded(pk?: string, min = 0.02) {
  if (!pk) return false;
  const b = await pub.getBalance({ address: privateKeyToAccount(pk as Hex).address });
  return Number(formatEther(b)) >= min;
}

test.describe("wallet connection", () => {
  test("EIP-6963 wallet is discovered, connects, shows the pill, and disconnects with the power icon", async ({ page }) => {
    const w = await installWallet(page, process.env.HOLDER_PK as Hex);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    const modal = page.getByTestId("wallet-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: /Test Wallet/ })).toBeVisible();
    await modal.getByRole("button", { name: /Test Wallet/ }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByTestId("wallet-address")).toHaveText(short(w.account.address));
    expect(w.log.some((l) => l.method === "eth_requestAccounts")).toBeTruthy();
    await page.getByTestId("wallet-disconnect").click();
    await expect(page.getByTestId("connect-wallet")).toBeVisible();
  });

  test("a wallet on another chain is asked to switch to Elysium", async ({ page }) => {
    const w = await installWallet(page, process.env.HOLDER_PK as Hex, { startChain: 998 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await expect(page.getByTestId("wallet-address")).toBeVisible();
    // connect asks for Elysium; the wallet ends up there
    await expect.poll(() => w.chainId).toBe(99801);
    expect(w.log.some((l) => l.method === "wallet_switchEthereumChain")).toBeTruthy();
  });

  test("modal closes with Escape and shows chain guidance", async ({ page }) => {
    await installWallet(page, process.env.HOLDER_PK as Hex);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await expect(page.getByTestId("wallet-modal")).toContainText("99801");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("wallet-modal")).toBeHidden();
  });

  test("connection survives a page navigation and exposes the address on /cross", async ({ page }) => {
    const w = await installWallet(page, process.env.HOLDER_PK as Hex);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await page.getByTestId("nav-capsule").getByText("Cross").click();
    await page.waitForURL("**/cross");
    await expect(page.getByTestId("wallet-address")).toHaveText(short(w.account.address));
  });
});

test.describe("transaction flow, end to end on testnet", () => {
  test.skip(!deployed, "contracts are not deployed yet: run npm run deploy");

  test("holder claims, approves, crosses 100 LSEAL through LockGate", async ({ page }) => {
    test.skip(!(await funded(process.env.HOLDER_PK)), "holder wallet needs Elysium testnet HYPE");
    const w = await installWallet(page, process.env.HOLDER_PK as Hex);
    await page.goto("/cross", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await page.getByTestId("pick-sealed").click();

    // pre-flight must be fully green before the crossing
    await expect(page.getByTestId("preflight")).toBeVisible({ timeout: 30_000 });
    for (const id of ["sealed", "hold", "identity", "envelope", "route"]) await expect(page.locator(`[data-check="${id}"]`)).toHaveAttribute("data-ok", "true", { timeout: 30_000 });
    await expect(page.getByTestId("onchain-verdict")).toContainText("pass");

    const claim = page.getByTestId("claim");
    await claim.click();
    await expect(page.getByTestId("tx-status").first()).toHaveAttribute("data-status", /done|error/, { timeout: 90_000 });

    await page.getByTestId("in-amount").fill("100");
    await page.getByTestId("approve").click();
    await expect(page.getByTestId("tx-status").nth(1)).toHaveAttribute("data-status", "done", { timeout: 90_000 });
    await page.getByTestId("cross").click();
    await expect(page.getByTestId("claim-status")).toBeVisible({ timeout: 120_000 });
    const link = page.getByTestId("tx-link").last();
    await expect(link).toHaveAttribute("href", /elysium\.kinetiq\.xyz\/testnet-explorer\/tx\/0x[0-9a-f]{64}/);
    const hash = (await link.getAttribute("title")) as Hex;
    const rc = await pub.getTransactionReceipt({ hash });
    expect(rc.status).toBe("success");
    expect(w.hashes).toContain(hash);
  });

  test("renamed drift token is refused with a decoded error and the refusal is recorded on chain", async ({ page }) => {
    test.skip(!(await funded(process.env.DEPLOYER_PK)), "deployer wallet needs Elysium testnet HYPE");
    const w = await installWallet(page, process.env.DEPLOYER_PK as Hex);
    await page.goto("/cross", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await page.getByTestId("pick-drift").click();
    await expect(page.getByTestId("preflight")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("claim").click().catch(() => undefined);
    await page.getByTestId("in-amount").fill("10");
    const rename = page.getByTestId("rename");
    // make sure the token is in the drifted state
    const identity = page.locator('[data-check="identity"]');
    if ((await identity.getAttribute("data-ok")) === "true") {
      await rename.click();
      await expect(identity).toHaveAttribute("data-ok", "false", { timeout: 90_000 });
    }
    await page.getByTestId("approve").click();
    await page.getByTestId("cross").click();
    await expect(page.getByTestId("tx-error").last()).toContainText(/MetadataDrift|MirrorIdentityDrift/, { timeout: 60_000 });
    await page.getByTestId("force-cross").click();
    await expect(page.getByTestId("tx-status").last()).toHaveAttribute("data-status", "error", { timeout: 120_000 });
    const hash = (await page.getByTestId("tx-link").last().getAttribute("title")) as Hex;
    const rc = await pub.getTransactionReceipt({ hash });
    expect(rc.status).toBe("reverted");
    expect(w.hashes).toContain(hash);
  });
});
