"use client";

import { useCallback, useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Abi, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { elysiumTestnet } from "./chains";

export type TxState = {
  status: "idle" | "simulating" | "wallet" | "pending" | "done" | "error";
  hash?: Hex;
  error?: string;
  /** decoded custom error name when the call reverted, for example MetadataDrift */
  revert?: { name: string; args?: readonly unknown[] };
};

export type TxRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  chainId?: number;
  /** skip the pre-send simulation (used to prove a refusal on chain with a forced gas limit) */
  force?: { gas: bigint };
};

export function decodeError(e: unknown): { message: string; revert?: { name: string; args?: readonly unknown[] } } {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (r?.data) return { message: `${r.data.errorName}`, revert: { name: r.data.errorName, args: r.data.args } };
    if (r?.reason) return { message: r.reason, revert: { name: r.reason } };
    return { message: e.shortMessage || e.message.split("\n")[0] };
  }
  return { message: (e as Error)?.message?.split("\n")[0] ?? "Unknown error" };
}

export function useTx() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const ely = usePublicClient({ chainId: elysiumTestnet.id });
  const [state, setState] = useState<TxState>({ status: "idle" });

  const run = useCallback(
    async (req: TxRequest): Promise<Hex | null> => {
      const chainId = req.chainId ?? elysiumTestnet.id;
      try {
        if (!address) throw new Error("Connect a wallet first.");
        setState({ status: "simulating" });
        await switchChainAsync({ chainId: chainId as 99801 | 998 }).catch(() => undefined);
        if (!req.force && ely && chainId === elysiumTestnet.id) {
          await ely.simulateContract({ account: address, address: req.address, abi: req.abi, functionName: req.functionName, args: req.args as never, value: req.value });
        }
        setState({ status: "wallet" });
        const hash = await writeContractAsync({
          address: req.address,
          abi: req.abi,
          functionName: req.functionName,
          args: req.args as never,
          value: req.value,
          chainId,
          ...(req.force ? { gas: req.force.gas } : {}),
        } as never);
        setState({ status: "pending", hash });
        const rc = await ely?.waitForTransactionReceipt({ hash, timeout: 90_000 });
        if (rc && rc.status === "reverted") {
          setState({ status: "error", hash, error: "The transaction reverted on chain.", revert: req.force ? { name: "Reverted" } : undefined });
          return hash;
        }
        setState({ status: "done", hash });
        return hash;
      } catch (e) {
        const d = decodeError(e);
        setState((s) => ({ status: "error", hash: s.hash, error: d.message, revert: d.revert }));
        return null;
      }
    },
    [address, ely, switchChainAsync, writeContractAsync],
  );

  return { state, run, reset: () => setState({ status: "idle" }) };
}
