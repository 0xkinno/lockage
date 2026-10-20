# JUDGE GUIDE

## 60 seconds, no wallet
1. `/survey`, press **Ines at 23:10**. Two lines go red (metadata identity, supply growth), the supply line passes at weiDecimals 7, and the decimals line says every deposit must be a multiple of 100,000,000,000 base units.
2. Press **Fixed and locked**. Every line passes at weiDecimals 8.
3. `/proof`. Contracts, tests, and the recorded counterfactual.

## 3 minutes, with a testnet wallet
1. Connect on `/cross` (Elysium testnet is added if missing).
2. Pick LSEAL: five green checks. Claim 1,000, approve, cross 100. A real transaction link appears.
3. Pick LDRIFT: after the owner's rename the identity check is red and the call is refused with a decoded error before you sign. **Send anyway** records the refusal on chain.
4. `/census` for the wild set and the named misses.

## 10 minutes
1. `contracts/src/LockGate.sol`: nine reverts and one exact-escrow check.
2. `src/lib/envelope.ts` beside `contracts/src/LockSurvey.sol`; `forge test --match-contract EnvelopeTwin` feeds both the same 10,000 vectors.
3. `/keeper`: sweeps run versus decisions asked; Acknowledge and Hold are bound to the finding hash.
4. `/certificate/<token>`: print it.
5. `docs/DISCOVERY.md`: every claim VERIFIED or UNKNOWN.
