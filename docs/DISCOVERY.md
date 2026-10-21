# DISCOVERY

Every claim is marked **VERIFIED** with the command or script that produced it, or **UNKNOWN** with what would settle it. An UNKNOWN is never stated as fact in the README or the app.

## 1. Primitive

The Elysium to HyperEVM to HyperCore graduation path: `ElysiumBridgeFactory` (live-metadata pairing), `ElysiumMirrorFactory`, the bridge-wallet gateway, and HyperCore's HIP-1 `weiDecimals` and `uint64` rules.

## 2. What was verified on 2026-10-20

| Claim | Status | How |
|---|---|---|
| Elysium testnet chain id is 99801 (`0x185d9`) | VERIFIED | `curl -X POST https://testnet-rpc.elysium.kinetiq.xyz -d '{"method":"eth_chainId"}'` |
| HyperEVM testnet chain id is 998 (`0x3e6`) | VERIFIED | same call against `https://rpc.hyperliquid-testnet.xyz/evm` |
| All published bridge addresses have code (factory, router, wallet gateway on Elysium; mirror factory, router, mirror gateway, outbox on HyperEVM) | VERIFIED | `cast code <addr> --rpc-url ...` returned non-empty code for each |
| `expectedL1Mirror(token)` answers for an arbitrary token without deployment | VERIFIED | `cast call 0xb94A...BE5a "expectedL1Mirror(address)(address)" <token>` |
| Elysium gas price is 0.1 gwei, blocks are about 100 to 200 ms | VERIFIED | `cast gas-price`, block timestamps |
| The Elysium RPC caps `eth_getLogs` at 10,000 results per call | VERIFIED | a 100,000 block range returned `logs count limit exceeded (10000)` |
| The Elysium explorer exposes no Blockscout-style API | VERIFIED | `/testnet-explorer/api/v2/tokens` returns the HTML app, not JSON |
| Both RPCs and the Hyperliquid info API allow browser origins (CORS `*`) | VERIFIED | `curl -i -X OPTIONS ... -H 'Origin: ...'` |
| HyperCore testnet `spotMeta` lists 1,673 tokens; 843 use weiDecimals 8; 14 violate `szDecimals + 5 <= weiDecimals` | VERIFIED | `npm run verify:envelope`, saved to `data/envelope-verification.json` |
| The envelope rules hold for real HyperCore tokens that have a linked EVM contract | VERIFIED with named exceptions | 80 linked tokens checked; exceptions (USDC and tokens whose reported max supply is at the uint64 ceiling) are listed in the data file. LOCKAGE plans 10% below the ceiling, so it is stricter than HyperCore. |
| The Solidity and TypeScript envelope agree | VERIFIED | `forge test --match-contract EnvelopeTwin`: 10,000 shared vectors |
| A contract (not an EOA) can call `outboundTransfer` on the real router and bridge-wallet gateway, and the real escrow wallet receives the exact amount | VERIFIED on testnet and in a fork | A signed LockGate crossing succeeded on testnet: [0x932ff313...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x932ff313d27c0b47e7164986bf0ad3976bf8583ed4b968203fb1644307a73d7f). First proven in a fork simulation (`FOUNDRY_PROFILE=fork forge test`, token `CTR`) with an ArbSys stand-in. The two-step fallback is not needed. |

### 2.1 The census and its spam floor

The Transfer-log scan found **1,096,760** distinct ERC-20 emitters. 850,832 of them emitted exactly one Transfer and 242,619 exactly two: single-mint deployment spam. The census surveys the contracts with at least three transfers and publishes both the cut and the spam counts (see `/census`). A contract that never emitted a Transfer is not seen.

The bytecode scan cannot run the signed on-chain probe, so the transfer-behaviour line is reported as "not measured" for every census row and is excluded from the census verdict. This is stated on the census page.

## 3. The three contradictions

### D1. Mirror identity drift (headline)

Status: **VERIFIED on testnet, 2026-10-20.** Reproduced by `npm run experiment:drift` on `DriftToken 0xc63edc7f5b55f7c1ad905e949e18e5552f10056b`. Every transaction hash is in `data/experiments/drift-2026-10-20.json` and on `/proof`.

| Question | Answer, by experiment |
|---|---|
| Does the factory name a new canonical mirror after a rename? | **Yes.** `expectedL1Mirror` moved from `0x6EFE371E05Ad9ECfE68192dA87d694FFC4A53B16` to `0xe1089bD7953De63a68dc319588d63A3030af9D3D` after `setSymbol` ([0xc6af76c8...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0xc6af76c88b60ef134a4d601bc815abc6990bfbc061d019ad0b981b8b11690cc5)). |
| (a) Does the old wallet still accept locks keyed on the old mirror? | **Yes.** The raw router accepted a crossing keyed on the old mirror after the rename: [0x22a5623e...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x22a5623e1bfd6fc879d43a5c6383432a521943508dd17bc9a2079db8c6755c01). The router has no memory of the identity change. |
| (b) Can a second wallet be created for the new metadata? | **Yes.** `createL2Wallet` succeeded again after the rename and `l2WalletFor` now returns a new escrow wallet, so one token has two escrow wallets. |
| (c) After crossing again, do two mirrors exist? | **Two live routes, one canonical mirror.** My first attempt at the new mirror reverted with selector `0x13be252b`, which I decoded: it is `InsufficientAllowance()` on the demo token (I had not approved the second wallet), not a bridge refusal. After approving the second wallet ([0x3f027354...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x3f027354fb8f328217aa39336bf489033496ea050f24794af965abc95709a307)), a raw crossing keyed on the NEW mirror was accepted ([0x5e4b14f9...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x5e4b14f90f35a116d86d495eb9e98cbec4c45e538e21ec7dda2e59029a0bf363)). So after a rename the router accepts locks on both mirrors for one token. Mirror supply on HyperEVM only mints when an outbox message is executed, after an output root covers it; that execution is pending the output root (see D3), and the keeper reads both pairs on every sweep. |
| What does LockGate do after the rename? | **Refuses.** `MetadataDrift`, preflight code 3. [0x41081ed6...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x41081ed61fdd91620cfaf66b1cca2e96d802f3c0fa45b5807755278b86b7bf2b) is the on-chain reverted transaction (forced gas, so the refusal is recorded). |

The finding is real: after a rename, holders can keep sending funds into a mirror the factory no longer calls canonical, and a second escrow wallet appears for the same token. LockGate refuses both. The control, `SealedToken` through LockGate, succeeded: [0x932ff313...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x932ff313d27c0b47e7164986bf0ad3976bf8583ed4b968203fb1644307a73d7f).

### D2. The graduation envelope

Status: **VERIFIED** (math, twin equality, ground truth above).

For EVM decimals `d` and supply in base units `S`, a weiDecimals `w` is feasible when `5 <= w <= 8`, `d - 18 <= w <= d + 2`, `S * 10^(w-d) <= 0.9 * (2^64 - 1)` (or `S` is a multiple of `10^(d-w)` when `w < d`).

Decision recorded: the planning cap on `w` is **8**. 843 of 1,673 live testnet tokens sit at 8, 1,607 are at or below it, and 66 older tokens use 9 or 10 (listed in the verification file). A cap of 8 matches the build brief's examples (1B at 18 decimals gives 8, 1T gives 7) and is conservative. Anything above `1.66e14` whole tokens at 18 decimals has no feasible `w`.

### D3. Escrow versus mirror books, and the challenge window

Status: **configured window VERIFIED, observed end-to-end time UNKNOWN (waiting).**

- The Rollup contract on HyperEVM reports `confirmPeriodBlocks = 10`. HyperEVM's measured block time is 0.984 s, so the configured period is about 9.8 s. Read by `npm run challenge` on 2026-10-21, saved to `data/challenge-config.json`.
- The observed end-to-end time (an Elysium send until an output root covering it is posted to the HyperEVM Bridge) is measured by `scripts/measure-window.ts`. The first crossing was sent 2026-10-20T14:21:14.000Z. At the last check no covering root had been posted, so the figure stays UNKNOWN and the app says "waiting since 14:21 UTC". Nothing is estimated.
- The pending-message accounting is VERIFIED: the keeper reads escrow equal to mirror supply plus pending per pair, for every pair a token owns.

### D4. A rename path no selector scan can see

Status: **VERIFIED on testnet, 2026-10-21.** `UpgradeToken` (0x4b49f432c9c55abe34b0c8684f7303ce7ec0de4f) is a UUPS proxy with no `setSymbol` or `setName`. Sealed, crossed through LockGate ([0x9c76b8a6...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x9c76b8a6ec0f5d37db4020b7ffc32559eb6b6f0a53310fc13d987073314bf683)), then its admin upgraded the implementation ([0xf81a3ac4...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0xf81a3ac405475b958ec9669082d1a04028c926a1de49992b82c54242f447e559)): the symbol went from LUPG to LUPG2 and the canonical mirror moved. LockGate then refused with `MetadataDrift`: [0x2a948c9c...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x2a948c9c50454686766da33b9f69f72411aa5eba0937b2ba31bb9f188f7abdf0). The survey now reads the EIP-1967 admin slot and the UUPS selector, and reports "Identity can change by upgrade" as a block.

## 4. Open items

| Item | Status |
|---|---|
| Mirror registration latency on testnet | VERIFIED: the router registered each mirror about 60 to 70 seconds after `createAndRegisterL1Mirror` (`data/setup.json`) |
| Challenge window length | UNKNOWN: not elapsed at last check; measured by the scheduled workflow |
| Deposit-wallet factory addresses | UNKNOWN: not published by Kinetiq. The deposit-wallet leg is computed, not executed. |
| HyperCore read precompile and ElysiumCoreWriter | UNKNOWN: not shipped. Roadmap only. |
| Ascend's four-stage ladder primary source | Named by Ascend's incubator announcement on X (2026-10-20): Ascended status and ecosystem buybacks, HyperCore spot listings, eligible HIP-3 perpetual markets through Kinetiq. UNKNOWN until the post URL is pasted and cited |
| Current HyperCore ticker auction price | VERIFIED: 945.56 HYPE on mainnet on 2026-10-21 (`spotDeployState`, `data/auction-2026-10-21.json`) |

## 5. Textbook check

"Pre-launch token checker" exists as a genre (honeypot scanners, launch readiness dashboards). None compute HyperCore's graduation envelope, none seal mirror identity, and none gate a crossing on it.

## 6. Delete test

Remove Elysium's bridge factory and mirror factory and LOCKAGE has nothing to seal, gate or reconcile. Remove HyperCore's HIP-1 rules and the envelope is meaningless. The product cannot exist off this stack.
