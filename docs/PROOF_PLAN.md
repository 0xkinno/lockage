# PROOF PLAN

1. **Wild set (nobody curated).** Every ERC-20 emitter on Elysium testnet, found by scanning Transfer logs with an adaptive window. The census surveys contracts with at least 3 transfers and publishes the spam floor. `npm run census`.
2. **Control set.** 30 sampled tokens with an `owner()`, labelled by execution: simulate mint and rename calls as the owner with `eth_call`. This is a different method from the selector scan under test, and it is one-sided (a revert does not prove absence), so false negatives are lower bounds. The heuristic's false positives and false negatives are reported side by side, every miss named by address. File: `data/control-set.json`, scored by `scripts/score-control.ts`.
3. **Counterfactual.** Baseline: `DriftToken`, rename, cross on the raw router. Control: `SealedToken` through LockGate succeeds. Intervention: `DriftToken` after rename through LockGate reverts. `npm run experiment:drift`.
4. **Envelope ground truth.** The rules reproduce the weiDecimals and szDecimals constraints of real HyperCore testnet tokens. `npm run verify:envelope`.
5. **Cost per unit.** Gas and HYPE for one survey, one seal, one crossing, measured on dated runs (`data/costs.json`).
6. **Theme metric.** Lockkeeper sweeps run versus builder decisions requested (`data/ledger.json`).
7. **Failure demo on screen.** `/cross` with the drift token: a real reverted transaction with the decoded error.
8. **Unattended run.** A scheduled GitHub Actions lockkeeper that commits its ledger.

The proof could come out against us. If the census shows most tokens graduate fine, or the drift experiment shows the factory handles it, we publish that. If D1 comes out "handled", the headline becomes the envelope and the seal stays a holder-side check.
