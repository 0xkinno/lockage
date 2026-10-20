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
import { scan as gauge, EIP1967_IMPL_SLOT } from "../src/lib/bytecode";
import { runSurvey } from "../src/lib/survey";

const TRANSFER = keccak256(toHex("Transfer(address,address,uint256)"));
const ADDR_FILE = "data/census-addresses.json";
const OUT_FILE = "data/census.json";

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
        const logs = await ely.request({
          method: "eth_getLogs",
          params: [{ fromBlock: toHex(a), toBlock: toHex(b), topics: [TRANSFER] }],
        });
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
  logs: number;
};

async function analyze() {
  const book = loadBook();
  const addrs = Object.keys(book.tokens) as Address[];
  console.log("analyzing", addrs.length, "candidates");
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
    const res = await ely.multicall({ contracts: calls as never, allowFailure: true });
    for (let j = 0; j < chunk.length; j++) {
      const a = chunk[j];
      const r = res.slice(j * 7, j * 7 + 7);
      const ok = (x: (typeof r)[number]) => (x.status === "success" ? (x.result as unknown) : null);
      const name = ok(r[0]) as string | null;
      const symbol = ok(r[1]) as string | null;
      const decimals = ok(r[2]) as number | null;
      const supply = ok(r[3]) as bigint | null;
      const owner = ok(r[4]) as Address | null;
      const wallet = ok(r[5]) as Address | null;
      const mirror = ok(r[6]) as Address | null;
      const base: Row = {
        address: a, name, symbol, decimals, totalSupply: supply?.toString() ?? null, codeSize: 0, graduates: null, bestWei: null,
        verdict: "invalid", blocks: [], unknowns: [], flags: [], hasWallet: !!wallet && wallet !== "0x0000000000000000000000000000000000000000",
        mirror, owner, proxyImpl: null, logs: book.tokens[a].logs,
      };
      if (decimals === null || supply === null || name === null || symbol === null) {
        rows.push(base);
        continue;
      }
      const code = (await ely.getCode({ address: a })) ?? "0x";
      base.codeSize = (code.length - 2) / 2;
      let impl: Hex | null = null;
      if (base.codeSize < 400) {
        const slot = await ely.getStorageAt({ address: a, slot: EIP1967_IMPL_SLOT });
        if (slot && /[1-9a-f]/i.test(slot.slice(2))) {
          const implAddr = getAddress("0x" + slot.slice(26));
          base.proxyImpl = implAddr;
          impl = ((await ely.getCode({ address: implAddr })) ?? null) as Hex | null;
        }
      }
      const scan = gauge(code as Hex, impl);
      const s = runSurvey({ decimals, supplyBase: supply, scan });
      base.graduates = s.env.graduates;
      base.bestWei = s.env.graduates ? s.env.bestWei : null;
      base.verdict = s.overall;
      base.blocks = s.lines.filter((l) => l.verdict === "block").map((l) => l.id);
      base.unknowns = s.lines.filter((l) => l.verdict === "unknown").map((l) => l.id);
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
    candidates: addrs.length,
    surveyed: valid.length,
    notErc20Metadata: rows.length - valid.length,
    canGraduateAsIs: count((r) => r.verdict === "pass"),
    graduatesByMathAlone: count((r) => r.graduates === true),
    blockedBySupplyOrDecimals: count((r) => r.graduates === false),
    mutableMetadata: count((r) => r.flags.includes("rename")),
    mintable: count((r) => r.flags.includes("mint")),
    taxOrRebaseLikely: count((r) => r.flags.includes("tax") || r.flags.includes("rebase")),
    unreadableProxy: count((r) => r.unknowns.length > 0),
    withBridgeWallet: count((r) => r.hasWallet),
  };
  writeFileSync(OUT_FILE, JSON.stringify({ summary, tokens: rows.sort((a, b) => b.logs - a.logs) }, null, 1));
  console.log("\n", summary);
}

const mode = process.argv[2] ?? "all";
if (mode === "scan" || mode === "all") await scanAddresses();
if (mode === "analyze" || mode === "all") await analyze();
