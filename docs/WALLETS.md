# Test wallets and how to fund them

These four wallets were generated for LOCKAGE on Elysium testnet and HyperEVM testnet only. The private keys live in `.env` (gitignored, never committed). Do not send real funds to them.

| Role | Address | Needs on Elysium (99801) | Needs on HyperEVM (998) | What it does |
|---|---|---|---|---|
| Deployer | `0x7c8A5a8b84a9A552c4A964dDe23266fA9A6Aa344` | 0.5 HYPE | 0.05 HYPE | Deploys contracts, seals tokens, runs the drift experiment, pays mirror registration |
| Builder (Ines) | `0x165c4E1226F32475E5a9a2f3833d484323bE6351` | 0.1 HYPE | none | End-to-end test: seals a token, acknowledges a finding |
| Holder (Rahul) | `0xaa951F424E17f519be135215185a3D03e172BB7E` | 0.1 HYPE | none | End-to-end test: approves and crosses through LockGate |
| Keeper | `0xE65101c72FFe52AcAC048127793D938A3133CcBf` | none | none | Read only, holds no funds |

Check balances at any time:

```bash
npm run balances
```

## Step 1. Elysium testnet HYPE (gas on Elysium)

1. Open https://elysium.kinetiq.xyz/testnet-faucet
2. Click **Connect** and connect a wallet. The faucet pays 1 HYPE to the connected wallet.
3. Click **Add Elysium Testnet to wallet** if the network is missing (chain id 99801, RPC `https://testnet-rpc.elysium.kinetiq.xyz`).
4. Click **Get HYPE on Elysium Testnet**.

Two ways to get it onto the LOCKAGE wallets:

- **Easiest:** claim in your own wallet, then send 0.5 HYPE to the Deployer address and 0.1 HYPE each to Builder and Holder.
- **Direct:** import a LOCKAGE private key from `.env` into a throwaway browser wallet profile, connect that profile to the faucet, claim, repeat per wallet.

If the faucet limits one claim per day per address, use the direct route for the Deployer first and the others later.

## Step 2. HyperEVM testnet HYPE (the Deployer only)

Mirror registration is paid in HYPE on HyperEVM testnet (about 0.0013 HYPE per token pair, so 0.05 covers the whole run with room).

1. Open the Quicknode HyperEVM testnet faucet linked from the Elysium faucet page.
2. Paste the **Deployer** address `0x7c8A5a8b84a9A552c4A964dDe23266fA9A6Aa344`.
3. Claim. If it asks for a mainnet balance, use the alternative below.

Alternative, no faucet: send HYPE from Elysium to HyperEVM through the bridge at https://elysium.kinetiq.xyz/bridge (withdraw 0.1 HYPE to the Deployer address). It arrives after the challenge window.

## Step 3. Tell me when it is done

Run `npm run balances`. When Deployer, Builder and Holder show OK, run:

```bash
npm run go-live
```

That deploys the contracts, seals the demo tokens, registers the mirrors, runs the drift experiment and counterfactual, measures the challenge window, sweeps the keeper, regenerates FACTS and rebuilds the census.

## Safety notes

- Keys are testnet throwaways. `.env` is gitignored and `check:copy` fails the build if a key pattern appears in a committed file.
- Never put these keys in Vercel. The app signs everything with the visitor's own wallet. Only the public RPC URLs and contract addresses are needed there.
