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
| A contract (not an EOA) can call `outboundTransfer` on the real router and bridge-wallet gateway, and the real escrow wallet receives the exact amount | VERIFIED in a fork simulation | `FOUNDRY_PROFILE=fork forge test`, token `CTR 0xd5aC...9D19`. ArbSys is a stand-in because forge does not run Arbitrum precompiles. A signed transaction on testnet confirms it after funding (see section 4). |

### 2.1 The census and its spam floor

The Transfer-log scan found **1,096,760** distinct ERC-20 emitters. 850,832 of them emitted exactly one Transfer and 242,619 exactly two: single-mint deployment spam. The census surveys the contracts with at least three transfers and publishes both the cut and the spam counts (see `/census`). A contract that never emitted a Transfer is not seen.

The bytecode scan cannot run the signed on-chain probe, so the transfer-behaviour line is reported as "not measured" for every census row and is excluded from the census verdict. This is stated on the census page.

## 3. The three contradictions

### D1. Mirror identity drift (headline)

Status: **designed and scripted, not yet run on testnet** (needs a funded deployer). `npm run experiment:drift` answers by experiment:

- (a) after a rename, does the old wallet still accept locks keyed on the old mirror?
- (b) can a second wallet be created for the new metadata?
- (c) after crossing again, do two mirrors with nonzero supply exist?

Every transaction hash is recorded to `data/experiments/drift-<date>.json`. Whatever the outcome, the finding is real: either holders can keep minting a mirror the factory no longer calls canonical, or the token has two live mirrors. LockGate refuses both. If D1 turns out "handled by the factory", the headline becomes the envelope and the seal remains a holder-side check; the README will say so.

The contract-level behaviour of the refusal is VERIFIED by unit test (`test_counterfactual_drift_baseline_control_intervention`) against mocks of the factory and router. The live behaviour of the real router is UNKNOWN until the experiment runs.

### D2. The graduation envelope

Status: **VERIFIED** (math, twin equality, ground truth above).

For EVM decimals `d` and supply in base units `S`, a weiDecimals `w` is feasible when `5 <= w <= 8`, `d - 18 <= w <= d + 2`, `S * 10^(w-d) <= 0.9 * (2^64 - 1)` (or `S` is a multiple of `10^(d-w)` when `w < d`).

Decision recorded: the planning cap on `w` is **8**. 843 of 1,673 live testnet tokens sit at 8, 1,607 are at or below it, and 66 older tokens use 9 or 10 (listed in the verification file). A cap of 8 matches the build brief's examples (1B at 18 decimals gives 8, 1T gives 7) and is conservative. Anything above `1.66e14` whole tokens at 18 decimals has no feasible `w`.

### D3. Escrow versus mirror books

Status: **UNKNOWN** until one real crossing and `npm run measure:window` has run.

The invariant `escrow == mirrorSupply` only holds after finality. Between a lock and its execution on HyperEVM, `escrow = mirrorSupply + pending`. The keeper counts pending messages from ArbSys `L2ToL1Tx` events minus Outbox `isSpent` and abstains when it cannot read them. The challenge window is measured as the time from an Elysium send to the first `SendRootUpdated` on the HyperEVM Bridge whose Elysium block is at or after the send.

## 4. Open items

| Item | Status |
|---|---|
| Real-transaction confirmation that LockGate can cross through the live gateway | UNKNOWN until `npm run go-live` |
| Mirror registration latency on testnet | UNKNOWN until run |
| Challenge window length | UNKNOWN until measured |
| Deposit-wallet factory addresses | UNKNOWN: not published by Kinetiq. The deposit-wallet leg is computed, not executed. |
| HyperCore read precompile and ElysiumCoreWriter | UNKNOWN: not shipped. Roadmap only. |
| Ascend's four-stage ladder primary source link | UNKNOWN: to be cited from Ascend's own post before submission |
| Current HyperCore ticker auction price | UNKNOWN: to be read by dated script before submission |

## 5. Textbook check

"Pre-launch token checker" exists as a genre (honeypot scanners, launch readiness dashboards). None compute HyperCore's graduation envelope, none seal mirror identity, and none gate a crossing on it.

## 6. Delete test

Remove Elysium's bridge factory and mirror factory and LOCKAGE has nothing to seal, gate or reconcile. Remove HyperCore's HIP-1 rules and the envelope is meaningless. The product cannot exist off this stack.
