# PROOF

Live numbers are on `/proof` and in `docs/FACTS.json`. This file records how each proof item is produced and its current state.

| Item | Produced by | State |
|---|---|---|
| Wild set census | `npm run census` | Run 2026-10-20 |
| Control set, both error directions | `npx tsx scripts/score-control.ts` | Run 2026-10-20; ground truth by execution (eth_call as owner), one-sided, stated on `/census` |
| Counterfactual: baseline, control, intervention | `npm run experiment:drift` | Run 2026-10-20, hashes on `/proof` |
| Envelope ground truth | `npm run verify:envelope` | Run 2026-10-20 |
| Twin equality | `forge test --match-contract EnvelopeTwin` | 10,000 vectors, passing |
| Contract tests | `forge test` | 68 passing |
| Live gateway compatibility | `FOUNDRY_PROFILE=fork forge test` | 3 passing, fork simulation |
| Cost per unit | `data/deployments.json`, `data/setup.json`, `data/experiments/` receipts | Run 2026-10-20 (`costs` in FACTS) |
| Sweeps versus decisions | `data/ledger.json` | First sweep 2026-10-20 |
| Unattended run | `.github/workflows/lockkeeper.yml` | Pending first push |

If a result comes out against us it is published as found.
