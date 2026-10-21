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

## LOCKAGE deployments (Elysium testnet 99801, 2026-10-20)

Deployer `0x7c8A5a8b84a9A552c4A964dDe23266fA9A6Aa344`.

| Contract | Address | Deploy tx | Gas |
|---|---|---|---|
| LockSurvey | `0xd62ec5f3fe3e97b25f0276db59e9be188d68e920` | [0x2bcf1f77...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x2bcf1f771e662dcc92f74099ab664cbb20875a361fbc0604d285ca389cc055df) | 1,013,377 |
| LockLedger | `0xe0651987e8992b51b2ee0d73883777810a4938ac` | [0x9ab285e2...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x9ab285e223971bf87f15c17b5b324fa935c602e366394da42c18b811c388249f) | 609,683 |
| LockGate | `0xacdfa87818a91f68c4ccf89ef0375e7984f4d6fe` | [0x278d0968...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x278d09687e82000d6239534616ede18cb4d8150cd941d5ddd0d052306d0c3d80) | 1,293,971 |
| LockProbe | `0x9baac75a4e0e12dd6ed7fd70b1f844c9b8f3ef36` | [0x4a93a568...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x4a93a568d302939a3b046bc10863ef2392838bd4c6c38905c6780d4eb4ef59ab) | 401,036 |
| SealedToken | `0xa16b878da523e42892455704ab34dbd98b488462` | [0xc04242ce...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0xc04242ce9b74efcff7b0b5a223b6d8b40a0e9ac7335932c30d1fa5d14af6085c) | 511,222 |
| DriftToken | `0xc63edc7f5b55f7c1ad905e949e18e5552f10056b` | [0xef8eefc3...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0xef8eefc31e194972662a87ee02c5497a4514796e052d144d91aee70f8b937295) | 759,045 |
| OversizeToken | `0xa9539fd9c256f8b19f3fd4759eda9c90edbbbe7c` | [0xccf3d224...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0xccf3d2249438f852f6655e33e247b8142bf9a689acf0590b2c241f034f05a974) | 511,286 |
| TaxToken | `0xa302f4331b6be3013b5acbb7ef0c093dcfcb91bb` | [0xcad82b0b...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0xcad82b0b3c6244fdf5ea20f3912fe3ce2dfb1c58cd1e185e7fe0c775d534221d) | 580,055 |
| MintToken | `0xe1bccd5e9a0a800d7337a534e4b27a24e5498742` | [0x39e1688a...](https://elysium.kinetiq.xyz/testnet-explorer/tx/0x39e1688a1c0fdfb685aa5fede297364edcfa7dfac9bbb104d889964320008532) | 600,712 |

The build is reproducible (solc 0.8.28, optimizer 200, `bytecode_hash = none`). All twelve contracts are source-verified on the Elysium testnet explorer (`npm run verify:sources`, Blockscout API, original build settings). Open any address on the explorer and choose the Contract tab.

Bridge pairs (escrow wallet, registered mirror, router route) were set up for LSEAL, LDRIFT, LTAX and LMINT; steps and hashes are in `data/setup.json`. LBIG is sealed only and has no pair on purpose.

## Dated runs

| Run | Date | File |
|---|---|---|
| Envelope ground truth against HyperCore testnet | 2026-10-20 | `data/envelope-verification.json` |
| Transfer-log scan | 2026-10-20 | `data/census-public.json` (summary) |
| Control set | 2026-10-20 | `data/control-set.json` |
| Fork test of LockGate against the live gateway | 2026-10-20 | `contracts/test/ForkGate.t.sol` |
| Deploy, seal and pair, keeper sweep | 2026-10-20 | `data/deployments.json`, `data/setup.json`, `data/ledger.json` |
| Drift experiment and counterfactual | 2026-10-20 | `data/experiments/` |
| Challenge window | pending (measured by the scheduled workflow) | `data/challenge-window.json` |
