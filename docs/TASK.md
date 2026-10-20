# TASK

## Phase 0. Setup and rules
- [x] Repo initialised; git identity `0xkinno` (email: GitHub noreply, to be confirmed by the owner)
- [x] Server-side attribution-block workflow, local `commit-msg` hook, and repo settings that clear commit attribution
- [x] `.gitignore` covers reference/, .env*, out/, cache/, broadcast/, node_modules/
- [x] Reference docs saved to `reference/docs/`; `reference/BANNED_NAMES.txt` written (reference repos are not cloned: not needed to build)
- [x] `RULES_EXTRACT.md`; deadline AM or PM still to confirm with the organiser (UNKNOWN)
- [ ] Create GitHub repo `0xkinno/lockage` and push (owner action)

## Phase 1. Discovery
- [x] Foundry installed locally; demo tokens; LockSurvey; envelope fuzz and 10,000-vector twin equality
- [x] Test wallets generated (`docs/WALLETS.md`)
- [ ] Fund deployer on Elysium and HyperEVM (owner action, see WALLETS.md)
- [ ] Deploy LockSurvey; seal SealedToken and DriftToken
- [ ] Run `experiment-drift.ts`; write D1 outcomes
- [x] Envelope verified against live HyperCore testnet tokens (`data/envelope-verification.json`)
- [ ] Measure challenge window with a real crossing
- [x] MOMENT.md, THESIS.md, PROOF_PLAN.md

## Phase 2. Mechanism
- [x] LockProbe, LockGate, LockLedger; 68 offline tests plus fork tests
- [x] LockGate proven against the live router and gateway in a fork simulation (contract callers work)
- [ ] Deploy all; verify sources on the explorer; EVIDENCE.md with tx hashes
- [ ] Counterfactual run: baseline, control, intervention

## Phase 3. Proof harness
- [x] Census scan of every Transfer emitter (1,096,760) and analysis of the active set
- [x] Control set scored by execution; misses both directions named
- [x] `lockkeeper.ts`; GitHub Actions schedule written
- [ ] First unattended run committed (after deploy and push)
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
- [ ] Final red-team round after the live run

## Phase 7. Ship
- [x] README rendered from FACTS; PROOF.md; MILESTONES.md; PROGRESS.md
- [x] SUBMISSION_ASCEND.md mirroring the six Discord fields
- [ ] Video recorded (owner), X thread, submission ticket, tag, freeze (owner actions, never done without asking)
