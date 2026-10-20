# PROGRESS

## 2026-10-20
- Contracts built and tested: 68 offline tests, 10,000-vector envelope twin, 3 fork tests against the live router and gateway.
- Finding: a contract can call the real bridge-wallet gateway through the real router; the real escrow wallet received the exact amount (fork simulation with an ArbSys stand-in).
- Finding: Elysium testnet holds 1,096,760 ERC-20 emitters; 850,832 emitted exactly one Transfer and 242,619 exactly two. The census surveys the rest.
- Envelope checked against 80 live HyperCore testnet tokens that have a linked EVM contract; exceptions are named in `data/envelope-verification.json`.
- App built: all eight routes, production build green, wallet connection verified with a real EIP-6963 test wallet signing locally.
- Hero photograph placed full width behind the landing copy.
- Wallets funded. Deployed all nine contracts, sealed and paired four tokens, ran the drift experiment, a keeper sweep, and the browser suite against the live contracts.
- D1 answered on chain: after a rename the raw router still accepts the old mirror, a second escrow wallet can be created, and LockGate refuses with MetadataDrift (reverted tx recorded).
- Open: the challenge window had not elapsed at the last check; the scheduled workflow measures it.
- Pushed to https://github.com/0xkinno/lockage. CI green after fixing the browser install path and making wallet tests keyless.
- Deployed to Vercel production: https://lockage-kinnoskis-projects.vercel.app. The full browser suite (6 viewports, axe, fonts, overlap, real-wallet transactions) passes against it: 65 of 65.
- README rewritten with deployed-contract and bridge-pair link tables and landscape crops of the live app.
