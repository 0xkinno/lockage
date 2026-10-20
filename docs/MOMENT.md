# MOMENT

**Persona (fictional, labelled as such on every surface):** Ines Moraes, a solo builder in Porto, launching her first token on Ascend for a small trading tool she has built for a year.

**Moment, with a clock:** 23:10, the night of her launch. The form asks for a name, a symbol and a supply. She types `1,000,000,000,000` because big supplies look cheap per token, and her template lets the owner rename the token later in case of a rebrand. The launch transaction is irreversible.

Four months later her token qualifies for HyperCore. At genesis she learns three things in one evening:

1. Her supply does not fit HyperCore's `uint64` Core-wei ceiling at the granularity she wanted. She must accept a coarser `weiDecimals`, which caps `szDecimals`, and every holder deposit must be a multiple of `10^(18 - weiDecimals)` base units or it reverts `AmountNotCoreAligned`.
2. The mirror bridge keys a token's identity on its live `name`, `symbol` and `decimals`. The rebrand she did in month two moved the canonical mirror to a new address. Holders who crossed before it hold the old mirror.
3. Her owner `mint` means genesis supply cannot back every possible EVM unit, which the deposit-wallet invariant requires.

None of this is a bug in Elysium. It is in the docs, on three pages, written for issuers who already know to look. Nobody told her at the only moment it was cheap to fix: before launch.

**Second persona (fictional):** Rahul, in Pune, holds Ines's token and wants it on HyperEVM. His moment is the crossing: he should never lock tokens into a route the factory no longer calls canonical.

**Artifact she keeps:** a Lock Certificate (on-chain seal plus a printable one-page card) she can show holders and Ascend.

**Founder stake:** `$LOCK` is launching through Ascend. LOCKAGE surveys its own token first.

**Assumption versus reality:** everyone assumes "launched on Elysium" means "can climb to HyperCore later". In reality the climb is decided at launch, by five token properties, under one-shot permanent rules.
