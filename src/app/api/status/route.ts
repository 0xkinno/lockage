import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { elysiumTestnet, hyperEvmTestnet } from "@/lib/chains";
import { facts } from "@/lib/facts";

export const dynamic = "force-dynamic";

async function probe(name: string, chain: typeof elysiumTestnet | typeof hyperEvmTestnet) {
  const url = chain.rpcUrls.default.http[0];
  const t0 = Date.now();
  try {
    const c = createPublicClient({ chain, transport: http(url, { timeout: 8000, retryCount: 0 }) });
    const [id, head] = await Promise.all([c.getChainId(), c.getBlockNumber()]);
    return { name, ok: id === chain.id, chainId: id, head: Number(head), ms: Date.now() - t0, source: new URL(url).host };
  } catch (e) {
    return { name, ok: false, error: String((e as Error).message).split("\n")[0].slice(0, 120), ms: Date.now() - t0, source: new URL(url).host };
  }
}

export async function GET() {
  const [ely, he] = await Promise.all([probe("elysium", elysiumTestnet), probe("hyperevm", hyperEvmTestnet)]);
  return NextResponse.json({ at: new Date().toISOString(), rpc: [ely, he], factsGeneratedAt: facts.generatedAt, keeper: facts.keeper });
}
