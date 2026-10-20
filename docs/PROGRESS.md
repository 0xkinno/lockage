# PROGRESS

## 2026-10-20
- Contracts built and tested: 68 offline tests, 10,000-vector envelope twin, 3 fork tests against the live router and gateway.
- Finding: a contract can call the real bridge-wallet gateway through the real router; the real escrow wallet received the exact amount (fork simulation with an ArbSys stand-in).
- Finding: Elysium testnet holds 1,096,760 ERC-20 emitters; 850,832 emitted exactly one Transfer and 242,619 exactly two. The census surveys the rest.
- Envelope checked against 80 live HyperCore testnet tokens that have a linked EVM contract; exceptions are named in `data/envelope-verification.json`.
- App built: all eight routes, production build green, wallet connection verified with a real EIP-6963 test wallet signing locally.
- Hero photograph placed full width behind the landing copy.
- Blocked: the live run needs funded wallets (`docs/WALLETS.md`). The Elysium faucet rejects addresses with no HyperEVM or Hyperliquid mainnet balance and sits behind a Cloudflare check; the Quicknode faucet needs a connected wallet.
