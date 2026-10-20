# EVIDENCE

## Network and addresses (checked 2026-10-20 against elysium.kinetiq.xyz/docs/bridge-contracts)

| | Elysium testnet 99801 |
|---|---|
| RPC | `https://testnet-rpc.elysium.kinetiq.xyz` |
| Explorer | `https://elysium.kinetiq.xyz/testnet-explorer` |
| Bridge factory | `0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a` |
| Gateway router | `0x89659883a9d980925733B0A698F117AAb65ac718` |
| Bridge-wallet gateway | `0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959` |
| ArbSys | `0x0000000000000000000000000000000000000064` |

| | HyperEVM testnet 998 |
|---|---|
| RPC | `https://rpc.hyperliquid-testnet.xyz/evm` |
| Mirror factory | `0xcaDb9986F3727177d48FA07294E1730f9D19290b` |
| Gateway router | `0x1aAE2caD8B0249905492087EF230FcCEa3707C45` |
| Mirror gateway | `0x08922Faa84aC2a54aa3cFD3725b03ca256F52Da2` |
| Outbox | `0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060` |
| Bridge | `0x36dAbc3CEE2E1084B7d04c8015Ef68Cac78f4f37` |

Mainnet is pre-launch. If mainnet addresses are published before submission they are recorded here and a redeploy is planned.

## LOCKAGE deployments

Deployment addresses, deploy transaction hashes, gas and fees are in `data/deployments.json` and rendered on `/proof`. Not yet deployed: waiting for funded wallets.

## Dated runs

| Run | Date | File |
|---|---|---|
| Envelope ground truth against HyperCore testnet | 2026-10-20 | `data/envelope-verification.json` |
| Transfer-log scan | 2026-10-20 | `data/census-public.json` (summary) |
| Control set | 2026-10-20 | `data/control-set.json` |
| Fork test of LockGate against the live gateway | 2026-10-20 | `contracts/test/ForkGate.t.sol` |
| Drift experiment and counterfactual | pending | `data/experiments/` |
| Challenge window | pending | `data/challenge-window.json` |
