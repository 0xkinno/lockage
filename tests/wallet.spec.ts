import { readFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { expect, test } from "@playwright/test";
import { elysiumTestnet } from "../src/lib/chains";
import { installWallet } from "./helpers/mockWallet";

config({ path: ".env", quiet: true });
test.use({ viewport: { width: 1366, height: 900 } });

const dep = existsSync("data/deployments.json") ? (JSON.parse(readFileSync("data/deployments.json", "utf8")) as { contracts: Record<string, { address: string }> }) : { contracts: {} };
const deployed = !!dep.contracts.LockGate;
const pub = createPublicClient({ chain: elysiumTestnet, transport: http() });
// CI has no secrets: connection tests use a throwaway key, and the funded transaction tests skip themselves
const walletKey = (k?: string) => (k as Hex | undefined) ?? generatePrivateKey();
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function funded(pk?: string, min = 0.02) {
  if (!pk) return false;
  const b = await pub.getBalance({ address: privateKeyToAccount(pk as Hex).address });
  return Number(formatEther(b)) >= min;
}

test.describe("wallet connection", () => {
  test("EIP-6963 wallet is discovered, connects, shows the pill, and disconnects with the power icon", async ({ page }) => {
    const w = await installWallet(page, walletKey(process.env.HOLDER_PK));
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
    const w = await installWallet(page, walletKey(process.env.HOLDER_PK), { startChain: 998 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await expect(page.getByTestId("wallet-address")).toBeVisible();
    // connect asks for Elysium; the wallet ends up there
    await expect.poll(() => w.chainId).toBe(99801);
    expect(w.log.some((l) => l.method === "wallet_switchEthereumChain")).toBeTruthy();
  });

  test("modal closes with Escape and shows chain guidance", async ({ page }) => {
    await installWallet(page, walletKey(process.env.HOLDER_PK));
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await expect(page.getByTestId("wallet-modal")).toContainText("99801");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("wallet-modal")).toBeHidden();
  });

  test("connection survives a page navigation and exposes the address on /cross", async ({ page }) => {
    const w = await installWallet(page, walletKey(process.env.HOLDER_PK));
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

  // The holder spends 100 LSEAL per run. Top it up from the deployer so the suite stays repeatable.
  test.beforeAll(async () => {
    if (!process.env.HOLDER_PK || !process.env.DEPLOYER_PK) return;
    const erc20 = [
      { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
      { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
    ] as const;
    const token = dep.contracts.SealedToken.address as Hex;
    const holder = privateKeyToAccount(process.env.HOLDER_PK as Hex).address;
    const bal = await pub.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [holder] });
    if (bal >= parseEther("250")) return;
    const w = createWalletClient({ account: privateKeyToAccount(process.env.DEPLOYER_PK as Hex), chain: elysiumTestnet, transport: http() });
    const hash = await w.writeContract({ address: token, abi: erc20, functionName: "transfer", args: [holder, parseEther("300")] });
    await pub.waitForTransactionReceipt({ hash });
  });

  test("holder claims, approves, crosses 100 LSEAL through LockGate", async ({ page }) => {
    test.skip(!(await funded(process.env.HOLDER_PK)), "holder wallet needs Elysium testnet HYPE");
    const w = await installWallet(page, walletKey(process.env.HOLDER_PK));
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
    const w = await installWallet(page, walletKey(process.env.DEPLOYER_PK));
    await page.goto("/cross", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await page.getByTestId("pick-drift").click();
    await expect(page.getByTestId("preflight")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("claim").click().catch(() => undefined);
    await page.getByTestId("in-amount").fill("10");
    const rename = page.getByTestId("rename");
    // make sure the token is in the drifted state, decided from the chain and not from the page
    const symbol = () => pub.readContract({ address: dep.contracts.DriftToken.address as Hex, abi: [{ type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }] as const, functionName: "symbol" });
    const identity = page.locator('[data-check="identity"]');
    if (!(await symbol()).endsWith("2")) {
      await rename.click();
      await expect.poll(symbol, { timeout: 90_000 }).toMatch(/2$/);
    }
    await page.reload({ waitUntil: "networkidle" });
    // the wallet already authorised this site, so wagmi reconnects by itself after a reload
    await expect(page.getByTestId("wallet-address")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("pick-drift").click();
    await expect(identity).toHaveAttribute("data-ok", "false", { timeout: 60_000 });
    await page.getByTestId("approve").click();
    await page.getByTestId("cross").click();
    await expect(page.getByTestId("tx-error").last()).toContainText(/MetadataDrift|MirrorIdentityDrift/, { timeout: 60_000 });
    await page.getByTestId("force-cross").click();
    // the simulation error is also an "error" status, so wait for the forced transaction's own hash
    const forcedLink = page.getByTestId("tx-status").last().getByTestId("tx-link");
    await expect(forcedLink).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("tx-status").last()).toContainText("Reverted", { timeout: 120_000 });
    const hash = (await forcedLink.getAttribute("title")) as Hex;
    const rc = await pub.getTransactionReceipt({ hash });
    expect(rc.status).toBe("reverted");
    expect(w.hashes).toContain(hash);
  });

  test("builder seals, probes and opens the certificate", async ({ page }) => {
    test.skip(!(await funded(process.env.DEPLOYER_PK)), "deployer wallet needs Elysium testnet HYPE");
    const w = await installWallet(page, walletKey(process.env.DEPLOYER_PK));
    await page.goto(`/survey?token=${dep.contracts.SealedToken.address}`, { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await expect(page.getByTestId("survey-result")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("seal").click();
    await expect(page.getByTestId("tx-status").first()).toHaveAttribute("data-status", "done", { timeout: 90_000 });
    await expect(page.getByTestId("open-certificate")).toBeVisible();
    await page.getByTestId("run-probe").click();
    await expect(page.getByTestId("probe-result")).toContainText("got exactly that back", { timeout: 120_000 });
    await expect(page.locator('[data-line="transfer"]')).toHaveAttribute("data-verdict", "pass", { timeout: 30_000 });
    expect(w.hashes.length).toBeGreaterThanOrEqual(2);
    await page.getByTestId("open-certificate").click();
    await expect(page.getByTestId("certificate")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("seal-state")).toContainText("Sealed");
    await expect(page.getByTestId("certificate")).toContainText("Matches the seal");
  });

  test("keeper finds the drift, and the builder's acknowledgement is signed and bound to the finding", async ({ page }) => {
    test.skip(!(await funded(process.env.DEPLOYER_PK)), "deployer wallet needs Elysium testnet HYPE");
    const w = await installWallet(page, walletKey(process.env.DEPLOYER_PK));
    await page.goto("/keeper", { waitUntil: "networkidle" });
    await page.getByTestId("connect-wallet").click();
    await page.getByTestId("wallet-modal").getByRole("button", { name: /Test Wallet/ }).click();
    await page.getByTestId("sweep-now").click();
    const rows = page.getByTestId("keeper-row");
    await expect(rows.first()).toBeVisible({ timeout: 90_000 });
    const finding = page.getByTestId("finding").first();
    await expect(finding).toBeVisible({ timeout: 90_000 });
    await expect(finding).toContainText(/identity|books/i);
    await finding.getByTestId("acknowledge").click();
    await expect(finding.getByTestId("tx-status")).toHaveAttribute("data-status", "done", { timeout: 90_000 });
    await expect(page.getByTestId("decision").first()).toContainText("acknowledged");
    expect(w.hashes.length).toBeGreaterThanOrEqual(1);
  });
});
