<div align="center">

# LOCKAGE

**Know before you launch on Ascend.**

Whether your token can ever reach a HyperCore orderbook is decided the night you launch it.
LOCKAGE reads that back to you first, seals the token's bridge identity, and refuses any crossing whose route has drifted.

[![Live](https://img.shields.io/badge/live-lockage.vercel-C8F04A?style=flat-square&labelColor=12140C)](https://lockage-kinnoskis-projects.vercel.app)
[![CI](https://github.com/0xkinno/lockage/actions/workflows/ci.yml/badge.svg)](https://github.com/0xkinno/lockage/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-C8F04A?style=flat-square&labelColor=12140C)](LICENSE)

</div>

![LOCKAGE landing page](docs/screenshots/banner.png)

| | |
|---|---|
| **Live app** | https://lockage-kinnoskis-projects.vercel.app |
| **Judge walk** | [/judge](https://lockage-kinnoskis-projects.vercel.app/judge): 60 seconds, 3 minutes, 10 minutes |
| **Proof page** | [/proof](https://lockage-kinnoskis-projects.vercel.app/proof): contracts, transaction hashes, measured costs |
| **Census** | [/census](https://lockage-kinnoskis-projects.vercel.app/census): the wild set of Elysium testnet tokens |
| **Network** | Elysium testnet (99801) settling to HyperEVM testnet (998) |
| **Tests** | {{fact:tests.passed}} contract tests passing, fuzzed at {{fact:tests.fuzzRunsPerProperty}} runs; 12 contracts source-verified on the explorer |
| **Embed for Ascend** | [/embed](https://lockage-kinnoskis-projects.vercel.app/embed?decimals=18&supply=1000000000000&rename=1) and `GET /api/survey` |
| **Author** | [0xkinno](https://github.com/0xkinno) |

---

## The finding in one paragraph

Everyone assumes a token launched on Elysium can climb to HyperCore later. It cannot, unless five properties were right at launch: supply, decimals, metadata mutability, mintability and transfer behaviour. The climb's third rung is a one-shot, irreversible ceremony whose parameters are permanent, and the mirror bridge keys a token's identity on its live `name`, `symbol` and `decimals`. We reproduced the consequence on chain: **after a single `setSymbol`, the raw router kept accepting crossings keyed on the old mirror, a second escrow wallet could be created for the same token, and only LockGate refused.** Both transactions are below, one accepted and one reverted.

### The number that saves builders money

**{{fact:census.blockedBySupplyOrDecimals}} of {{fact:census.surveyed}} surveyed Elysium testnet tokens ({{pct:census.blockedBySupplyOrDecimals,census.surveyed}}) can never graduate** because of their supply or decimals, and {{fact:census.identityUpgradeable}} more can change their own identity by upgrade. Each of them found out after launch, when nothing can change. The selector scan finds {{fact:census.mutableMetadata}} tokens with a rename function. That zero is real and it is not comfort: a proxy's name and symbol can change through an upgrade with no rename function at all, which is why the survey reads the EIP-1967 admin slot from storage, and why the upgrade counterfactual below exists.

## The problem, in a person

Ines is a solo builder in Porto (a fictional persona). At 23:10 on launch night she types a supply of one trillion because big numbers look cheap, and leaves the owner able to rename the token in case of a rebrand. Four months later HyperCore asks her for permanent choices she can no longer make freely: a coarser granularity than she wanted, a bridge identity her rebrand already moved, and a genesis supply her owner `mint` can outgrow.

None of it is an Elysium bug. It is in the docs, on three pages, written for issuers who already know to look.

| What is true | Source |
|---|---|
| Elysium tokens reach HyperCore through the mirror bridge, then deposit-wallet linkage | [Token bridging on Elysium](https://elysium.kinetiq.xyz/docs/token-bridging-on-elysium) |
| Mirror identity is the token plus its exact live metadata; mutable metadata makes one pair per snapshot | [Token bridging architecture](https://elysium.kinetiq.xyz/docs/token-bridging-architecture) |
| The ticker spec is locked at auction, genesis is one-shot, the link is permanent | [HyperCore spot deployment](https://elysium.kinetiq.xyz/docs/hypercore-spot-deployment) |
| Ascend's ladder: Ascended status and ecosystem buybacks, HyperCore spot listings, eligible HIP-3 perpetual markets through Kinetiq | Ascend's incubator announcement on X, 2026-10-20 (post link to be added) |
| Buying a HyperCore ticker costs **{{ticker}} HYPE** on mainnet ({{tickerDate}}), and the decimals chosen then can never change | `spotDeployState` from the Hyperliquid info API, snapshot in `data/auction-*.json` |
| Core amounts are `uint64` Core wei; `szDecimals + 5 <= weiDecimals`; `evmExtraWeiDecimals` in [-2, 18] | same page, step 1 |
| Unaligned deposits revert `AmountNotCoreAligned`; fee-on-transfer and rebasing tokens are unsupported | [Deposit wallets](https://elysium.kinetiq.xyz/docs/hypercore-bridging-via-deposit-wallets) |

## What LOCKAGE does

LOCKAGE is five modules with typed outputs. No model sits in any decision path.

| Module | Where | Job |
|---|---|---|
| **Surveyor** | `LockSurvey.sol`, `src/lib/envelope.ts` | Computes the graduation envelope exactly as HyperCore will, and seals identity |
| **Gauger** | `src/lib/bytecode.ts`, `LockProbe.sol` | Reads what the bytecode can do; measures what transfers actually do |
| **Gatekeeper** | `LockGate.sol` | The only crossing path: refuses on drift, wrong route or inexact escrow |
| **Lockkeeper** | `scripts/lockkeeper.ts` | Reconciles escrow, mirror supply and pending messages on a schedule |
| **Clerk** | `scripts/facts.ts` | Writes `docs/FACTS.json` from real runs. Every number below is read from it |

### The five lines

Each line says **Passes**, **Blocks graduation** or **Not determined**, and cites the rule behind it. When a property cannot be read, LOCKAGE abstains. It never prints a green verdict over a guess.

| # | Line | The rule | Decided by |
|---|---|---|---|
| 1 | Supply fit | Core amounts are `uint64` in Core wei | Exact integer math, twin-tested |
| 2 | Decimals plan | `szDecimals + 5 <= weiDecimals`; deposits must be core-aligned | Exact integer math |
| 3 | Metadata identity | Mirror = token + exact live name, symbol, decimals | Bytecode selectors, then the seal |
| 4 | Supply growth | Escrow must back genesis supply exactly | Bytecode selectors |
| 5 | Transfer behaviour | Fee-on-transfer and rebasing are unsupported | An on-chain probe: measured, not guessed |

### The guarantee, enforced in Solidity

> A crossing through LOCKAGE either lands on the mirror the token was sealed with, through a registered route, with exact escrow, or it reverts before any funds move.

| Refusal | Revert | Proven by |
|---|---|---|
| Token was never sealed | `NotSealed` | unit test |
| Name, symbol or decimals changed | `MetadataDrift` | unit test, **live transaction** |
| Factory now names a different mirror | `MirrorIdentityDrift` | unit test |
| Supply grew past the sealed envelope | `EnvelopeBroken` | unit test |
| Escrow wallet missing, or route not the bridge-wallet gateway | `PairNotDeployed`, `RouteNotRegistered` | unit test, fork test |
| Escrow did not arrive exactly (tax, rebase, lying wallet) | `EscrowShortfall` | unit test |
| Builder pressed the brake | `OnHold` | unit test |
| Reentrancy | `Reentered` | unit test |

## Proof: measured, not claimed

### 1. The drift, reproduced on Elysium testnet

{{table:evidence}}

What the experiment answered, by execution rather than by reading docs:

- **Does a rename move the canonical mirror?** Yes. `expectedL1Mirror` changed address.
- **Does the old route still accept locks keyed on the old mirror?** Yes. The router has no memory of the identity change.
- **Can a second escrow wallet be created for the new metadata?** Yes. One token, two wallets.
- **Does LockGate catch it?** Yes, before any funds move, and the refusal is recorded on chain.
- **Is the new route usable?** Yes. After approving the second wallet, a raw crossing keyed on the **new** mirror was accepted too, so one token has two live routes and only one canonical mirror. (The first attempt reverted with `0x13be252b`, which decodes to the demo token's own `InsufficientAllowance()`: a missing approval, not a bridge refusal.)
- **Do two mirrors end up with nonzero supply?** Mirror supply only mints when an outbox message is executed, after an output root covers it. The keeper reads both pairs on every sweep and the answer is recorded in `docs/DISCOVERY.md`.

### 2. A rename that no selector scan can see

`UpgradeToken` is a UUPS proxy with no `setSymbol` and no `setName`. Its admin upgrades the implementation and the symbol changes anyway. LockGate does not read the function list, it reads the live metadata, so it refuses:

{{table:upgrade}}

### 3. The wild set

The scan found **{{fact:census.candidates}}** ERC-20 emitters on Elysium testnet. {{fact:census.spam.exactlyOneTransfer}} emitted exactly one Transfer and {{fact:census.spam.exactlyTwoTransfers}} exactly two: single-mint deployment spam, counted and published but not surveyed. LOCKAGE surveyed the **{{fact:census.surveyed}}** contracts with at least {{fact:census.minTransfers}} transfers.

| Measure | Result |
|---|---|
| Clear on the four lines a scan can read | **{{pct:census.canGraduateAsIs,census.surveyed}}** ({{fact:census.canGraduateAsIs}}) |
| Blocked by supply or decimals | {{fact:census.blockedBySupplyOrDecimals}} |
| Owner mint found | {{fact:census.mintable}} |
| Mutable metadata found by selector scan | {{fact:census.mutableMetadata}} |
| Identity can change by upgrade (EIP-1967 admin slot or UUPS `upgradeToAndCall`) | {{fact:census.identityUpgradeable}} |
| Unreadable proxies (reported as Not determined) | {{fact:census.unreadableProxy}} |
| Already paired with an escrow wallet on the bridge | {{fact:census.withBridgeWallet}} |

The selector scan is a heuristic, so it is scored. A control set of {{fact:controlSet.sampled}} tokens is labelled by **execution** (simulating `mint` and rename calls as the owner), a different method from the one under test. Both error directions are published and every miss is named on [/census](https://lockage-kinnoskis-projects.vercel.app/census).

### 4. The envelope against ground truth

The formula was checked against HyperCore testnet's own token list ({{fact:envelopeVerification.spotTokens}} tokens, {{fact:envelopeVerification.checked}} with linked EVM contracts). {{fact:envelopeVerification.consistentWithRules}} are consistent with the rules; the exceptions (the system token USDC and tokens whose reported max supply sits at the hard `uint64` ceiling) are named in `data/envelope-verification.json`. LOCKAGE plans 10% below that ceiling on purpose, so it is stricter than HyperCore itself.

### 5. Tests

**{{fact:tests.passed}}** Foundry tests pass, fuzzed at {{fact:tests.fuzzRunsPerProperty}} runs per property. The Solidity and TypeScript envelopes are fed the same **{{fact:tests.twinVectors}}** vectors and must agree exactly. Fork tests run LockGate against the real factory, router and bridge-wallet gateway. A browser suite on six viewports drives a **real EIP-6963 wallet signing real testnet transactions**: claim, approve, cross, refusal, seal, probe, certificate, keeper decision.

## Product Screenshot

| Survey: Ines at 23:10 | Cross: refused after the rename |
|---|---|
| ![Survey](docs/screenshots/survey.png) | ![Refusal](docs/screenshots/cross-refusal.png) |
| **Keeper: unattended reconciliation** | **Proof: contracts and transactions** |
| ![Keeper](docs/screenshots/keeper.png) | ![Proof](docs/screenshots/proof.png) |

## Deployed contracts

Elysium testnet (99801), deployed 2026-10-20 and 2026-10-21 by `0x7c8A...a344`. Total deployment cost: {{hype:deployments.totalDeployFeeWei}} HYPE for all twelve contracts. **All twelve are source-verified on the explorer**: each address below opens the verified Contract tab.

{{table:contracts}}

### Bridge pairs

Each bridged demo token has a live escrow wallet and a registered HyperEVM mirror. LBIG is sealed only: it can never graduate, so it has no pair on purpose. The LDRIFT row shows the token **after** its rename: the mirror and wallet are the second pair created for the new metadata.

{{table:pairs}}

### Elysium infrastructure used

| Component | Address |
|---|---|
| Bridge factory | [`0xb94A...BE5a`](https://elysium.kinetiq.xyz/testnet-explorer/address/0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a) |
| Gateway router | [`0x8965...c718`](https://elysium.kinetiq.xyz/testnet-explorer/address/0x89659883a9d980925733B0A698F117AAb65ac718) |
| Bridge-wallet gateway | [`0x7255...F959`](https://elysium.kinetiq.xyz/testnet-explorer/address/0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959) |
| ArbSys | `0x0000...0064` |
| Mirror factory (HyperEVM) | [`0xcaDb...290b`](https://testnet.hyperevm-explorer.xyz/address/0xcaDb9986F3727177d48FA07294E1730f9D19290b) |
| Outbox (HyperEVM) | [`0x8739...1060`](https://testnet.hyperevm-explorer.xyz/address/0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060) |

## Architecture

```mermaid
flowchart LR
  subgraph EL[Elysium testnet 99801]
    T[Builder token]
    S[LockSurvey]
    G[LockGate]
    BF[Bridge factory]
    W[Escrow wallet]
    R[Gateway router]
  end
  subgraph HE[HyperEVM testnet 998]
    MF[Mirror factory]
    M[Mirror token]
  end
  K[Lockkeeper] --> W
  K --> M
  UI[App, wallet signs] --> S
  UI --> G
  G --> BF
  G --> R --> W
  W -. L2 to L1 message .-> M
  MF --> M
```

```text
 HyperCore   ......................... spot orderbook, the third rung
                                            ^
 HyperEVM    [ mirror token ] <---- gate two: output root, then the challenge window
                  ^
 Elysium     [ token ] --> [ LockGate ] --> [ escrow wallet ]
                           gate one: seal, route, exact escrow
```

```mermaid
flowchart TD
  A[Design or paste a token] --> B{Five lines}
  B -->|any blocks| C[Fix it before launch]
  B -->|all pass| D[Seal on chain]
  D --> E[Holder crosses through LockGate]
  E -->|identity moved| F[Refused, nothing moves]
  E -->|identity intact| G[Exact escrow, mirror mints after the window]
  G --> H[Lockkeeper reconciles on a schedule]
  H -->|books stop matching| I[Builder signs a decision]
```

### Trust model

| Question | Answer |
|---|---|
| Who can move user funds? | Only the user's own wallet. There is no server key. The lockkeeper is read-only |
| What is decided on chain? | The envelope, the seal, every crossing refusal, escrow exactness, builder holds |
| What is heuristic? | Whether bytecode can mint or rename. Misses are scored and published |
| Who can re-pin a drifted identity? | The sealer or the token's own `owner()`, never a stranger |
| What happens when LOCKAGE cannot tell? | It says Not determined and explains what would settle it |
| What if an RPC is down? | The app names which source answered, and never falls back silently |

The adversarial review is in [docs/REDTEAM_LOG.md](docs/REDTEAM_LOG.md): five roles attacked the build in two rounds, and every finding was fixed or recorded.

## Elysium, used specifically

| Feature | Where | Use |
|---|---|---|
| Bridge factory `expectedL1Mirror`, `l2WalletFor` | `LockSurvey.sol`, `LockGate.sol` | Names the canonical mirror and escrow wallet at call time |
| Gateway router `getGateway`, `outboundTransfer` | `LockGate.sol` | Verifies the route and sends the crossing; a contract caller works on the live gateway |
| Bridge-wallet gateway | `LockGate.sol` | The only route a sealed token may cross through |
| Mirror factory `createAndRegisterL1Mirror` | `scripts/_bridge.ts` | Registers a mirror for the exact live metadata |
| ArbSys `L2ToL1Tx`, HyperEVM Outbox `isSpent` | `src/lib/keeper.ts` | Counts pending messages, so the books reconcile after finality |
| HyperEVM Bridge `SendRootUpdated` | `scripts/measure-window.ts` | Measures the challenge window |

**Not used, so not claimed:** the HyperCore read precompile and ElysiumCoreWriter (not shipped yet) and the deposit-wallet factory (not published yet). The deposit-wallet leg is computed, not executed.

## Live versus designed

| Capability | State |
|---|---|
| Survey, envelope, Lock Certificate | Live on testnet |
| Seal, probe, LockGate crossing, builder decisions | Live on testnet, driven end to end by the browser suite with a real wallet |
| Drift refusal as a recorded reverted transaction | Live on testnet, hashes above |
| Lockkeeper reconciliation | Live; the scheduled workflow commits the ledger ({{fact:keeper.sweeps}} sweeps, {{fact:keeper.decisionsAsked}} decisions asked of the builder) |
| Challenge window | The rollup is configured for {{fact:challenge.confirmPeriodBlocks}} HyperEVM blocks (about {{fact:challenge.configuredPeriodSeconds}} s), read from the Rollup contract. The observed end-to-end time is unknown until an output root covers a crossing (waiting since 14:21 UTC on 2026-10-20) |
| Deposit-wallet leg and HyperCore genesis | Designed, waiting on Kinetiq's factory |
| Core supply reconciliation on chain | Designed, waiting on the read precompile |

## Judging criteria map

| Criterion | Where to look |
|---|---|
| **Execution** | Twelve deployed and verified contracts, {{fact:tests.passed}} tests, a real-wallet browser suite, a live Vercel deployment, an unattended workflow |
| **Usefulness** | {{fact:census.blockedBySupplyOrDecimals}} of {{fact:census.surveyed}} surveyed tokens ({{pct:census.blockedBySupplyOrDecimals,census.surveyed}}) are blocked by supply or decimals; the five lines before launch, an embeddable check, a crossing that cannot land on a stale route, a printable certificate, a census of the wild set |
| **Long-term vision** | `$LOCK` and the roadmap below, tied to Elysium's own schedule |
| **Originality** | The envelope computed exactly as HyperCore will, sealed bridge identity, a gate that refuses on drift, and a drift reproduced on chain. See [docs/DISCOVERY.md](docs/DISCOVERY.md) |

## For Ascend's launch form

A read endpoint, not a new product. The same five lines, as JSON, for a token that exists or one that does not yet:

```bash
# a token that does not exist yet (the launch-form case)
curl "https://lockage-kinnoskis-projects.vercel.app/api/survey?decimals=18&supply=1000000000000&rename=1&mint=0&tax=0"

# a deployed Elysium testnet token
curl "https://lockage-kinnoskis-projects.vercel.app/api/survey?address=0xa16b878da523e42892455704ab34dbd98b488462"
```

Each line carries its verdict and the rule behind it. Responses are cached for 60 seconds, rate limited per IP, and name the RPC that answered. `/embed` renders the same result as a 360px card for an iframe:

```html
<iframe src="https://lockage-kinnoskis-projects.vercel.app/embed?decimals=18&supply=1000000000000&rename=1" width="360" height="620" style="border:0"></iframe>
```

![Embed](docs/screenshots/embed.png)

## `$LOCK` and the roadmap

| Stage | State |
|---|---|
| **Working** | Contracts, app, census and keeper on Elysium testnet |
| **In development** | Deposit-wallet leg: LockGate extends from HyperEVM into HyperCore deposits with `AmountNotCoreAligned` pre-checks, once Kinetiq publishes the factory. The read precompile and CoreWriter follow about a month after mainnet |
| **Before launch** | Mainnet redeploy on Elysium mainnet day (announced as November 9, 2026); a public seal and certificate for `$LOCK` |
| **After launch** | **The toll:** surveys and holder crossings stay free; projects pay for a Graduation Package (sealed certificate, continuous keeper coverage, the scripted ceremony). Tolls fund `$LOCK` buybacks. Holders vote which Ascend launches get free coverage |

Ask of Ascend: a slot in the launch form for the envelope check, and an introduction to Kinetiq for early deposit-wallet factory addresses.

## Honest notes

- Testnet only. No mainnet funds are used.
- The selector scan cannot prove a negative. It is scored against ground truth and its misses are named.
- The census reads Transfer logs, so a contract that never emitted one is not seen, and the transfer-behaviour line stays "not measured" there because the probe needs a signed transaction.
- Items still unknown are listed, with what would settle them, in [docs/DISCOVERY.md](docs/DISCOVERY.md).

## Run it

```bash
npm install
npm run gen               # vectors, contract build, ABIs
npm run test:contracts    # offline tests, 10,000-vector twin equality
npm run dev               # http://localhost:3107
```

Reproduce the on-chain evidence with funded testnet wallets (see [docs/WALLETS.md](docs/WALLETS.md)):

```bash
npm run go-live          # deploy, seal, pair, drift experiment, keeper sweep, FACTS, README
```

| Path | What |
|---|---|
| `contracts/src` | LockSurvey, LockGate, LockProbe, LockLedger, demo tokens |
| `contracts/test` | Unit, fuzz, twin and fork tests |
| `src/lib`, `src/app`, `src/components` | Envelope twin, gauger, survey, keeper, and the app |
| `scripts` | Deploy, setup, experiments, census, lockkeeper, facts |
| `data` | Committed outputs of every dated run |
| `docs` | Discovery, proof plan, evidence, judge guide, FACTS |

Linked docs: [EVIDENCE](docs/EVIDENCE.md), [PROOF](docs/PROOF.md), [DISCOVERY](docs/DISCOVERY.md), [THESIS](docs/THESIS.md), [JUDGE](docs/JUDGE.md), [TASK](docs/TASK.md), [PROGRESS](docs/PROGRESS.md), [MILESTONES](docs/MILESTONES.md).

## Disclosures

AI assistants were used while building. Ines Moraes and Rahul are fictional personas. The demo tokens are ours.

MIT licensed. Built by [0xkinno](https://github.com/0xkinno) for the Ascend x Elysium Builder Competition.
