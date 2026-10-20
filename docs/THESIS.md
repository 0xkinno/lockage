# THESIS

```text
NAME:       LOCKAGE
MOMENT:     Ines, a solo builder launching on Ascend, sets supply, decimals and a rename switch at
            23:10 on launch night; four months later the HyperCore ceremony makes those choices permanent.
DISCOVERY:  everyone assumes a token launched on Elysium can climb to HyperCore later; in reality the
            climb is decided at launch, and a token whose name can change does not keep one bridge identity.
THESIS:     LOCKAGE tells a builder before launch whether her token can graduate, seals its bridge
            identity, and refuses any crossing whose route has drifted from the seal.
PROOF:      census of the active ERC-20 contracts on Elysium testnet (data we did not choose), plus a live
            drift reproduction: raw route accepted, LOCKAGE refused, both tx hashes.
```

**Primary guarantee, enforced in Solidity:** a crossing through LOCKAGE either lands on the mirror the token was sealed with, through a registered route, with exact escrow, or it reverts before any funds move.

**Interruption budget:** the lockkeeper runs unattended and asks the builder for a decision only for (1) identity drift, (2) books that do not reconcile after pending messages are counted, (3) supply growth past the sealed envelope. Everything else is logged, never surfaced.

**Abstention:** when a property cannot be determined (unverified bytecode, a proxy with an unreadable implementation), the survey says "Not determined" for that line, says what would determine it, and never prints a green verdict over it.

**Crew:** Surveyor (`LockSurvey.sol`, `envelope.ts`), Gauger (`bytecode.ts`, `LockProbe.sol`), Lockkeeper (`scripts/lockkeeper.ts`), Gatekeeper (`LockGate.sol`), Clerk (`scripts/facts.ts`). No model is in the decision path.
