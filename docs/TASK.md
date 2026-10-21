# TASK

## Phase 0. Setup and rules
- [x] Repo initialised; git identity `0xkinno` (email: GitHub noreply, to be confirmed by the owner)
- [x] Server-side attribution-block workflow, local `commit-msg` hook, and repo settings that clear commit attribution
- [x] `.gitignore` covers reference/, .env*, out/, cache/, broadcast/, node_modules/
- [x] Reference docs saved to `reference/docs/`; `reference/BANNED_NAMES.txt` written (reference repos are not cloned: not needed to build)
- [x] `RULES_EXTRACT.md`; deadline AM or PM still to confirm with the organiser (UNKNOWN)
- [x] Pushed to https://github.com/0xkinno/lockage, all commits authored by 0xkinno

## Phase 1. Discovery
- [x] Foundry installed locally; demo tokens; LockSurvey; envelope fuzz and 10,000-vector twin equality
- [x] Test wallets generated (`docs/WALLETS.md`)
- [x] Deployer, builder and holder funded
- [x] Deployed all contracts; sealed and paired LSEAL, LDRIFT, LTAX, LMINT; sealed LBIG
- [x] Ran `experiment-drift.ts`; D1 outcomes in DISCOVERY.md
- [x] Envelope verified against live HyperCore testnet tokens (`data/envelope-verification.json`)
- [ ] Challenge window: observed end-to-end time (configured period already read: 10 blocks)
- [x] MOMENT.md, THESIS.md, PROOF_PLAN.md

## Phase 2. Mechanism
- [x] LockProbe, LockGate, LockLedger; 68 offline tests plus fork tests
- [x] LockGate proven against the live router and gateway in a fork simulation (contract callers work)
- [x] Deployed; EVIDENCE.md has addresses and tx hashes (all nine sources verified on the explorer)
- [x] Counterfactual run with every tx hash

## Phase 3. Proof harness
- [x] Census scan of every Transfer emitter (1,096,760) and analysis of the active set
- [x] Control set scored by execution; misses both directions named
- [x] `lockkeeper.ts`; GitHub Actions schedule written
- [x] First unattended run: committed by the Lockkeeper workflow
- [x] `facts.ts`, `render-readme.ts`, `check-copy.ts` in CI

## Phase 4. App
- [x] Next app, production build green
- [x] Wallet modal (EIP-6963), network switch, disconnect power icon
- [x] `/survey` (design mode without a wallet; address mode reads the chain; seal and probe wallet-signed)
- [x] `/cross` (pre-flight, approve, cross, claim status, failure flow)
- [x] `/keeper` (ledger, acknowledge and hold bound to the finding hash)
- [x] `/certificate/[token]` with print CSS
- [x] `/census`, `/proof`, `/judge`, `/api/status`

## Phase 5. Design pass
- [x] Fonts, tokens, grain, capsule nav with sliding glow, plates with hover glow
- [x] Landing sections 1 to 8 with SVG artifacts and scroll motion
- [x] Hero photograph full width behind the copy, under a paper scrim, never covering text
- [x] Playwright suite on 6 viewports, axe AA, zero console errors, screenshots saved

## Phase 6. Judge and red team
- [x] JUDGE.md; red team log started
- [x] Final red-team round after the live run (REDTEAM_LOG.md round 2)

## Final pass (LOCKAGE_FINAL_PASS)
- [x] Task 1. Keeper runs unattended: failure diagnosed from the log (transient RPC error with no retry, then a `git add` of a missing file), retries, `rpcSource` in the ledger, `git pull --rebase`, dispatched once; a `keeper: unattended sweep` commit by 0xkinno landed on main. `sweeps` and `decisionsAsked` are separate and `/keeper` reads "N sweeps, M decisions asked"
- [x] Task 2. Keeper reports every pair a token has had; the LDRIFT2 finding names the stranded tokens, old wallet, old mirror and the canonical mirror; both pairs shown on `/keeper` and the certificate
- [x] Task 3. Question (c) settled: the earlier revert decoded to `InsufficientAllowance()` (0x13be252b); after approving the second wallet the router accepts crossings on both mirrors. Outbox execution waits for the output root
- [ ] Task 4. Challenge window: configured period read from the Rollup contract (10 blocks, about 9.8 s). The observed end-to-end time is UNKNOWN and shows "waiting since 14:21 UTC" until an output root covers a crossing
- [x] Task 5. Ticker auction price read from `spotDeployState` on mainnet and testnet, snapshot, FACTS, README line and a test. The ladder source URL still needs to be pasted
- [x] Task 6. Upgrade path: admin slot and UUPS detection, third state on survey line 3, `UpgradeToken`, counterfactual refused with MetadataDrift, README leads with the blocked number and explains the zero mutable-selector count
- [x] Task 7. `GET /api/survey`, `/embed`, README section with curl and screenshot
- [x] Task 8. Badges trimmed, mainnet date, checks and red team round recorded. `lockage.vercel.app` is taken by another project, so it is not used
- [x] Task 9. `docs/SUBMISSION_ASCEND_INCUBATOR.md` written and the application form prefilled

## Phase 7. Ship
- [x] Vercel production deployment with public env vars: https://lockage-kinnoskis-projects.vercel.app
- [x] Full Playwright suite (6 viewports, axe, fonts, overlap, real wallet transactions) run against the Vercel link
- [x] README rendered from FACTS; PROOF.md; MILESTONES.md; PROGRESS.md
- [x] SUBMISSION_ASCEND.md mirroring the six Discord fields
- [ ] Video recorded (owner), X thread, submission ticket, tag, freeze (owner actions, never done without asking)
