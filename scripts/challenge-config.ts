/**
 * What the chain itself says about the challenge window, with no estimate typed by hand:
 *  - the rollup's configured confirmPeriodBlocks, read from the Rollup contract on HyperEVM
 *  - HyperEVM's measured average block time over the last 1,000 blocks
 *  - the time our first crossing has been waiting (from its Elysium timestamp)
 * The observed end-to-end time (send to first covering output root) is measured by scripts/measure-window.ts and stays UNKNOWN until it lands.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { parseAbi } from "viem";
import { ely, he, sleep } from "./_env";
import { ADDR } from "../src/lib/chains";
import { arbSysAbi } from "../src/lib/abi";

const retry = async <T,>(f: () => Promise<T>) => { for (let i = 0; i < 6; i++) { try { return await f(); } catch { await sleep(1500 * (i + 1)); } } throw new Error("RPC unavailable"); };
const rollup = ADDR.hyperevm.rollup;
const blocks = await retry(() => he.readContract({ address: rollup, abi: parseAbi(["function confirmPeriodBlocks() view returns (uint64)"]), functionName: "confirmPeriodBlocks" }));
const head = await retry(() => he.getBlockNumber());
const [bNow, bOld] = await Promise.all([retry(() => he.getBlock({ blockNumber: head })), retry(() => he.getBlock({ blockNumber: head - 1000n }))]);
const blockTime = (Number(bNow.timestamp) - Number(bOld.timestamp)) / 1000;

const dep = JSON.parse(readFileSync("data/deployments.json", "utf8")).contracts;
const sends = await retry(() => ely.getContractEvents({ address: ADDR.elysium.arbSys, abi: arbSysAbi, eventName: "L2ToL1Tx", args: { destination: ADDR.hyperevm.mirrorGateway }, fromBlock: BigInt(dep.LockGate.block), toBlock: "latest" }));
const firstBlock = sends.length ? await retry(() => ely.getBlock({ blockNumber: sends[0].blockNumber })) : null;
const state = {
  readAt: new Date().toISOString(),
  rollup,
  confirmPeriodBlocks: Number(blocks),
  hyperEvmBlockTimeSeconds: Number(blockTime.toFixed(3)),
  configuredPeriodSeconds: Number((Number(blocks) * blockTime).toFixed(1)),
  firstCrossingSentAt: firstBlock ? new Date(Number(firstBlock.timestamp) * 1000).toISOString() : null,
  firstCrossingTx: sends[0]?.transactionHash ?? null,
  observedEndToEndSeconds: existsSync("data/challenge-window.json") ? JSON.parse(readFileSync("data/challenge-window.json", "utf8")).seconds : null,
};
writeFileSync("data/challenge-config.json", JSON.stringify(state, null, 2));
console.log(state);
