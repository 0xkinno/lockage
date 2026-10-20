/**
 * D3: measures the testnet challenge window from a real crossing. A message sent from Elysium becomes
 * executable on HyperEVM once an output root covering it is posted to the Bridge. We take the first
 * SendRootUpdated whose Elysium block is at or after the send, and report the time between the two.
 * Exits quietly when already measured or when no root has covered the send yet (the scheduled run retries).
 */
import { existsSync } from "node:fs";
import { keccak256, toHex, type Hex } from "viem";
import { ely, he, today } from "./_env";
import { ADDR } from "../src/lib/chains";
import { arbSysAbi } from "../src/lib/abi";
import { loadJson, saveJson } from "./_bridge";

if (existsSync("data/challenge-window.json")) {
  console.log("already measured:", loadJson("data/challenge-window.json", {}));
  process.exit(0);
}
const dep = loadJson<{ contracts: Record<string, { block: number }> }>("data/deployments.json", { contracts: {} });
if (!dep.contracts.LockGate) process.exit(0);

const sends = await ely.getContractEvents({ address: ADDR.elysium.arbSys, abi: arbSysAbi, eventName: "L2ToL1Tx", args: { destination: ADDR.hyperevm.mirrorGateway }, fromBlock: BigInt(dep.contracts.LockGate.block), toBlock: "latest" });
if (!sends.length) {
  console.log("no crossing yet; nothing to measure");
  process.exit(0);
}
const send = sends[0];
const sendBlock = await ely.getBlock({ blockNumber: send.blockNumber });
console.log("first send at Elysium block", send.blockNumber, new Date(Number(sendBlock.timestamp) * 1000).toISOString());

const topic = keccak256(toHex("SendRootUpdated(bytes32,bytes32)"));
const headHe = await he.getBlockNumber();
// first HyperEVM block at or after the send, by binary search on timestamps (the RPC caps getLogs at 1000 blocks)
let lo = 0n;
let hi = headHe;
while (lo < hi) {
  const mid = (lo + hi) / 2n;
  const t = (await he.getBlock({ blockNumber: mid })).timestamp;
  if (t < sendBlock.timestamp) lo = mid + 1n;
  else hi = mid;
}
for (let from = lo; from <= headHe; from += 1000n) {
  const to = from + 999n > headHe ? headHe : from + 999n;
  const logs = (await he.request({ method: "eth_getLogs", params: [{ address: ADDR.hyperevm.bridge, topics: [topic], fromBlock: toHex(from), toBlock: toHex(to) }] } as never)) as { topics: Hex[]; blockNumber: Hex }[];
  for (const l of logs) {
    let b;
    try {
      b = await ely.getBlock({ blockHash: l.topics[1] });
    } catch {
      continue;
    }
    if (b.number >= send.blockNumber) {
      const heBlock = await he.getBlock({ blockNumber: BigInt(l.blockNumber) });
      const seconds = Number(heBlock.timestamp) - Number(sendBlock.timestamp);
      if (seconds <= 0) continue;
      saveJson("data/challenge-window.json", { ranOn: today(), seconds, sendBlock: Number(send.blockNumber), sendTx: send.transactionHash, rootPostedAtHyperEvmBlock: Number(l.blockNumber), method: "time from the Elysium send to the first SendRootUpdated whose Elysium block is at or after the send" });
      console.log("challenge window measured:", seconds, "seconds");
      process.exit(0);
    }
  }
}
console.log("no output root covers the send yet; try again later");
