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

## Round 2, after the live run

| Role | Attack | Result |
|---|---|---|
| Chain skeptic | "The drift is theoretical" | Reproduced on testnet: raw router accepted the old mirror after a rename, a second escrow wallet was created, LockGate refused. Hashes on `/proof` |
| Chain skeptic | "A contract cannot call the bridge-wallet gateway" | A signed LockGate crossing succeeded on testnet |
| Honest-data critic | Keeper cries wolf on in-flight transfers | Pending messages are counted from ArbSys events minus Outbox `isSpent`; LSEAL reads in-flight, not a finding |
| UX critic | Real wallet flow untested | The browser suite drives a real EIP-6963 wallet signing real testnet transactions: claim, approve, cross, refusal, seal, probe, certificate, keeper acknowledgement |

Open: the challenge window length, which depends on the chain.

## Round 3, after the final pass

| Role | Attack | Result |
|---|---|---|
| Contract auditor | A rename path with no setter: upgrade the proxy | UpgradeToken: LockGate refused with MetadataDrift on chain; the survey now reads the EIP-1967 admin slot and the UUPS selector |
| Honest-data critic | "Zero mutable metadata means the risk is imaginary" | The README explains the zero, leads with the 19% blocked by supply or decimals, and counts identity that can change by upgrade |
| Honest-data critic | Keeper finding "escrow 0 does not equal supply 0 plus pending 200" is unreadable | Books reconcile per pair; the finding states the stranded amount, old wallet, old mirror and the canonical mirror |
| Honest-data critic | An undecoded revert was left as evidence | Decoded: 0x13be252b is InsufficientAllowance() on the demo token, a test-script mistake, not a bridge refusal; the experiment was rerun correctly |
| Chain skeptic | "Unattended" claim with no scheduled commit | Workflow fixed (retry, rebase, stage only existing files) and a keeper commit by 0xkinno landed on main |
| UX critic | Embed card leaks site chrome or overflows | /embed hides the header and footer, is 360px, and is covered by a browser test |
| Security reviewer | Public read endpoint abused | 60 second cache, per-IP rate limit, input validation with plain errors, names the RPC that answered |

Open: the observed challenge window, which waits on an output root.
