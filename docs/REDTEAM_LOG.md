# RED TEAM LOG

Five roles attack the build. Each finding is fixed or recorded.

## Round 1, 2026-10-20

| Role | Attack | Result |
|---|---|---|
| Contract auditor | Reenter `cross` or `probe` through a malicious token | Blocked by `nonReentrant`; tests `test_reentrancy_into_cross_blocked`, `test_probe_reentrancy_blocked` |
| Contract auditor | A stranger seals a token first, then locks the builder out of re-sealing | Fixed: a token's own `owner()` is also an authority, and the sealer can hand over (`LockSurvey.handOver`) |
| Contract auditor | A token that changes `decimals()` between calls | Caught as `MetadataDrift`; `test_liar_token_flip_is_caught_as_drift` |
| Contract auditor | Fee-on-transfer token to skew escrow | Refused with `EscrowShortfall` before funds move; `test_tax_token_reverts_with_shortfall` |
| Contract auditor | Dangling approvals left on the escrow wallet | Approval reset to zero after each crossing; asserted in tests |
| Honest-data critic | Census headline inflated by spam | Fixed: 1,093,451 single or double-transfer contracts are counted but not surveyed, and the cut is published |
| Honest-data critic | Transfer line always "unknown" in the census, so nothing could ever pass | Fixed: reported separately as not measured and excluded from the census verdict |
| Honest-data critic | Heuristic misses hidden | Control set scores both error directions and names every miss |
| UX critic | Wallet auto-connects before approval in tests | Fixed in the test wallet to mirror real wallets |
| UX critic | Phone and tablet hero text over the photograph | Fixed: stacked layout up to 1024px, scrim behind copy on desktop |
| Security reviewer | A server key can move user funds | None exists: the lockkeeper reads only; every write is wallet-signed |
| Security reviewer | Private keys in committed files | `.env` is gitignored; `check:copy` scans for key-shaped strings |

Open: a final round after the live run, covering the real router's behaviour on drift (D1).
