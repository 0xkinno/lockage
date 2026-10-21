/**
 * Census of every ERC-20 on Elysium testnet (data we did not choose).
 *   tsx scripts/census.ts scan      find token addresses from Transfer logs (resumable)
 *   tsx scripts/census.ts analyze   multicall metadata, run the envelope and the bytecode scan
 *   tsx scripts/census.ts           both
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getAddress, keccak256, toHex, type Address, type Hex } from "viem";
import { ely, sleep, today } from "./_env";
import { erc20Abi, bridgeFactoryAbi } from "../src/lib/abi";
import { ADDR } from "../src/lib/chains";
import { scan as gauge, EIP1967_ADMIN_SLOT, EIP1967_IMPL_SLOT } from "../src/lib/bytecode";
import { runSurvey } from "../src/lib/survey";

const TRANSFER = keccak256(toHex("Transfer(address,address,uint256)"));
const ADDR_FILE = "data/census-addresses.json";
const OUT_FILE = "data/census.json";
/** Contracts with fewer transfers than this are single-mint deployment spam on this testnet (see summary.spam). */
const MIN_TRANSFERS = 3;

type AddrBook = { cursor: number; head: number; tokens: Record<string, { first: number; logs: number }> };

function loadBook(): AddrBook {
  if (existsSync(ADDR_FILE)) return JSON.parse(readFileSync(ADDR_FILE, "utf8"));
  return { cursor: 0, head: 0, tokens: {} };
}

async function scanAddresses() {
  const book = loadBook();
  const head = Number(await ely.getBlockNumber());
  book.head = head;
  let from = book.cursor;
  let size = 20_000;
  let windows = 0;
  const started = Date.now();
  const CONC = 5;

  // work queue of [from,to] windows; failures split the window
  const queue: [number, number][] = [];
  const pushRange = (a: number, b: number, step: number) => {
    for (let s = a; s <= b; s += step) queue.push([s, Math.min(b, s + step - 1)]);
  };
  pushRange(from, head, size);

  async function worker() {
    while (queue.length) {
      const [a, b] = queue.shift()!;
      try {
        const logs = (await ely.request({
          method: "eth_getLogs",
          params: [{ fromBlock: toHex(a), toBlock: toHex(b), topics: [TRANSFER] }],
        } as never)) as unknown;
        for (const l of logs as { address: string; topics: string[]; blockNumber: string }[]) {
          if (l.topics.length !== 3) continue; // ERC-721 Transfer has 4 topics
          const k = getAddress(l.address);
          const e = (book.tokens[k] ??= { first: Number(l.blockNumber), logs: 0 });
          e.logs++;
          e.first = Math.min(e.first, Number(l.blockNumber));
        }
        windows++;
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        if (b > a && /limit|exceed|range|too many|more than/i.test(msg)) {
          const mid = Math.floor((a + b) / 2);
          queue.unshift([mid + 1, b], [a, mid]);
        } else if (b > a) {
          queue.push([a, b]);
          await sleep(1000);
        } else {
          console.error("single block failed", a, msg.slice(0, 120));
        }
      }
      if (windows % 25 === 0 && windows > 0) {
        process.stdout.write(`\r${windows} windows, ${Object.keys(book.tokens).length} token candidates, ${queue.length} queued, ${Math.round((Date.now() - started) / 1000)}s   `);
        writeFileSync(ADDR_FILE, JSON.stringify(book));
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  book.cursor = head + 1;
  writeFileSync(ADDR_FILE, JSON.stringify(book));
  console.log(`\nscan done: head ${head}, ${Object.keys(book.tokens).length} ERC-20 candidates, ${windows} windows`);
}

async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await sleep(600 * (i + 1));
    }
  }
  throw last;
}

type Row = {
  address: Address;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  codeSize: number;
  graduates: boolean | null;
  bestWei: number | null;
  verdict: "pass" | "block" | "unknown" | "invalid";
  blocks: string[];
  unknowns: string[];
  flags: string[];
  hasWallet: boolean;
  mirror: Address | null;
  owner: Address | null;
  proxyImpl: Address | null;
  unreadableProxy?: boolean;
  upgradeAdmin?: string | null;
  uups?: boolean;
  logs: number;
};

async function analyze() {
  const book = loadBook();
  const all = Object.entries(book.tokens);
  const addrs = all.filter(([, t]) => t.logs >= MIN_TRANSFERS).map(([a]) => a as Address);
  const spam = { exactlyOneTransfer: all.filter(([, t]) => t.logs === 1).length, exactlyTwoTransfers: all.filter(([, t]) => t.logs === 2).length };
  console.log("analyzing", addrs.length, "active candidates of", all.length);
  const rows: Row[] = [];
  const CH = 40;
  for (let i = 0; i < addrs.length; i += CH) {
    const chunk = addrs.slice(i, i + CH);
    const calls = chunk.flatMap((a) => [
      { address: a, abi: erc20Abi, functionName: "name" },
      { address: a, abi: erc20Abi, functionName: "symbol" },
      { address: a, abi: erc20Abi, functionName: "decimals" },
      { address: a, abi: erc20Abi, functionName: "totalSupply" },
      { address: a, abi: erc20Abi, functionName: "owner" },
      { address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "l2WalletFor", args: [a] },
      { address: ADDR.elysium.bridgeFactory, abi: bridgeFactoryAbi, functionName: "expectedL1Mirror", args: [a] },
    ]);
    const res = (await retry(() => ely.multicall({ contracts: calls as never, allowFailure: true }))) as { status: string; result?: unknown }[];
    const codes = await Promise.all(chunk.map((a) => retry(() => ely.getCode({ address: a })).catch(() => "0x" as Hex)));
    for (let j = 0; j < chunk.length; j++) {
      const a = chunk[j];
      const r = res.slice(j * 7, j * 7 + 7);
      const ok = (x: { status: string; result?: unknown }) => (x.status === "success" ? (x.result as unknown) : null);
      let name = ok(r[0]) as string | null;
      let symbol = ok(r[1]) as string | null;
      let decimals = ok(r[2]) as number | null;
      let supply = ok(r[3]) as bigint | null;
      const owner = ok(r[4]) as Address | null;
      const wallet = ok(r[5]) as Address | null;
      const mirror = ok(r[6]) as Address | null;
      const base: Row = {
        address: a, name, symbol, decimals, totalSupply: supply?.toString() ?? null, codeSize: 0, graduates: null, bestWei: null,
        verdict: "invalid", blocks: [], unknowns: [], flags: [], hasWallet: !!wallet && wallet !== "0x0000000000000000000000000000000000000000",
        mirror, owner, proxyImpl: null, logs: book.tokens[a].logs,
      };
      if (decimals === null || supply === null || name === null || symbol === null) {
        // a failed multicall slot may be a transient RPC error, so ask again one call at a time before declaring the token invalid
        const again = async <T,>(fn: string) => retry(() => ely.readContract({ address: a, abi: erc20Abi, functionName: fn } as never) as Promise<T>, 3).catch(() => null);
        const [n2, s2, d2, t2] = await Promise.all([again<string>("name"), again<string>("symbol"), again<number>("decimals"), again<bigint>("totalSupply")]);
        if (n2 === null || s2 === null || d2 === null || t2 === null) {
          rows.push(base);
          continue;
        }
        base.name = n2;
        base.symbol = s2;
        base.decimals = Number(d2);
        base.totalSupply = t2.toString();
        decimals = Number(d2);
        supply = t2;
        name = n2;
        symbol = s2;
      }
      const code = (codes[j] ?? "0x") as Hex;
      base.codeSize = (code.length - 2) / 2;
      let impl: Hex | null = null;
      if (base.codeSize < 400) {
        const slot = await retry(() => ely.getStorageAt({ address: a, slot: EIP1967_IMPL_SLOT })).catch(() => null);
        if (slot && /[1-9a-f]/i.test(slot.slice(2))) {
          const implAddr = getAddress("0x" + slot.slice(26));
          base.proxyImpl = implAddr;
          impl = ((await retry(() => ely.getCode({ address: implAddr })).catch(() => null)) ?? null) as Hex | null;
        }
      }
      let upgradeAdmin: string | null = null;
      if (base.codeSize < 400 || base.proxyImpl) {
        const adm = await retry(() => ely.getStorageAt({ address: a, slot: EIP1967_ADMIN_SLOT })).catch(() => null);
        if (adm && /[1-9a-f]/i.test(adm.slice(2))) upgradeAdmin = getAddress("0x" + adm.slice(26));
      }
      const scan = gauge(code as Hex, impl);
      scan.proxyAdmin = upgradeAdmin;
      base.upgradeAdmin = upgradeAdmin;
      base.uups = scan.uups;
      const s = runSurvey({ decimals, supplyBase: supply, scan });
      base.graduates = s.env.graduates;
      base.bestWei = s.env.graduates ? s.env.bestWei : null;
      // The census cannot run the signed on-chain probe, so the transfer line stays "not measured" for every token.
      // It is reported on its own and does not stop a token from counting as clear on the four lines a scan can read.
      base.blocks = s.lines.filter((l) => l.verdict === "block").map((l) => l.id);
      base.unknowns = s.lines.filter((l) => l.verdict === "unknown" && l.id !== "transfer").map((l) => l.id);
      base.verdict = base.blocks.length ? "block" : base.unknowns.length ? "unknown" : "pass";
      base.unreadableProxy = scan.unreadableProxy;
      base.flags = scan.matched;
      rows.push(base);
    }
    process.stdout.write(`\r${Math.min(i + CH, addrs.length)}/${addrs.length}   `);
  }
  const valid = rows.filter((r) => r.verdict !== "invalid");
  const count = (f: (r: Row) => boolean) => valid.filter(f).length;
  const summary = {
    ranOn: today(),
    headBlock: book.head,
    candidates: all.length,
    minTransfers: MIN_TRANSFERS,
    spam,
    surveyed: valid.length,
    notErc20Metadata: rows.length - valid.length,
    canGraduateAsIs: count((r) => r.verdict === "pass"),
    graduatesByMathAlone: count((r) => r.graduates === true),
    blockedBySupplyOrDecimals: count((r) => r.graduates === false),
    mutableMetadata: count((r) => r.flags.includes("rename")),
    mintable: count((r) => r.flags.includes("mint")),
    taxOrRebaseLikely: count((r) => r.flags.includes("tax") || r.flags.includes("rebase")),
    unreadableProxy: count((r) => r.unreadableProxy === true),
    identityUpgradeable: count((r) => !!r.upgradeAdmin || r.uups === true),
    upgradeAdminSet: count((r) => !!r.upgradeAdmin),
    uupsImplementations: count((r) => r.uups === true),
    transferNotMeasured: valid.length,
    withBridgeWallet: count((r) => r.hasWallet),
  };
  const sorted = rows.sort((a, b) => b.logs - a.logs);
  writeFileSync(OUT_FILE, JSON.stringify({ summary, tokens: sorted }, null, 1));
  const pub = sorted.filter((r) => r.verdict !== "invalid").map((r) => ({ address: r.address, name: r.name, symbol: r.symbol, decimals: r.decimals, totalSupply: r.totalSupply, verdict: r.verdict, blocks: r.blocks, unknowns: r.unknowns, flags: r.flags, bestWei: r.bestWei, logs: r.logs }));
  const prev = existsSync("data/census-misses.json") ? JSON.parse(readFileSync("data/census-misses.json", "utf8")) : [];
  writeFileSync("data/census-public.json", JSON.stringify({ summary, tokens: pub, misses: prev }));
  console.log("\n", summary);
}

const mode = process.argv[2] ?? "all";
if (mode === "scan" || mode === "all") await scanAddresses();
if (mode === "analyze" || mode === "all") await analyze();
