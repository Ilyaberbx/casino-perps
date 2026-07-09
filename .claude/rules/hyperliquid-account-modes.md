# Hyperliquid Account-Mode Rules

How to read balances, equity, and "funded / available-to-trade" figures for a Hyperliquid account **without** getting a phantom `$0` for unified / portfolio-margin users. This is the rule that the order-entry `$0 available` bug (perps snapshot read the wrong field) should never have allowed. Background: `docs/adr/0033-venue-transfer-capability-and-account-abstraction-mode.md`.

## 0. The trap, stated once

Hyperliquid splits funds into a **Perp** sub-account (USDC margin) and a **Spot** sub-account. But it also has **account abstraction modes**, read via `userAbstraction(user) → "disabled" | "default" | "unifiedAccount" | "portfolioMargin" | "dexAbstraction"`:

- **classic** (`default` / `disabled`) — perp margin lives in the perp clearinghouse, as you'd expect.
- **unified / portfolio-margin** (`unifiedAccount` / `portfolioMargin`) — **all balances and holds live in the spot clearinghouse state. The perp `clearinghouseState.marginSummary` is NOT meaningful — it reports ~0 even when the account is fully funded.** (Hyperliquid docs, verbatim; confirmed in the wild, CCXT #28093.)

So a funded unified account that reads `clearinghouseState.marginSummary.accountValue` (or `withdrawable`, or any raw perp-margin field) sees **~0** and renders a phantom empty state. That is the entire bug class this rule exists to kill.

## 1. Never read raw perp-margin fields to decide "funded / available / buying power"

The following raw venue fields are **classic-only** and are ~0 for unified accounts. Reading any of them to drive a funded-check, available-to-trade figure, buying power, or a balance row is **forbidden outside the mode-aware readers**:

- `clearinghouseState.marginSummary.*` (`accountValue`, `totalMarginUsed`, `totalRawUsd`, …)
- `clearinghouseState.withdrawable`
- `clearinghouseState.crossMarginSummary.*`

These literals may appear **only** inside `hyperliquid/services/portfolio-reader.ts` and `hyperliquid/services/balances-reader.ts`, and only inside the **segregated branch** (`isSegregatedAccount(...) === true`). Everywhere else — components, hooks, gates, other readers — consume the **mode-aware projected output**, never the raw field.

## 2. One source of truth for the mode

The account mode is detected **once**, in `hyperliquid-pull.ts` (`abstractionMode`), and exposed two ways. Do not re-query `userAbstraction` anywhere else, and do not branch on the raw literal outside the venue:

- **Inside the venue** (readers): branch via `isSegregatedAccount(pull.current().abstractionMode)` (`hyperliquid.utils.ts`). classic → `true`; `unifiedAccount` / `portfolioMargin` → `false`; **unknown / pre-fetch / read-error → `true`** (classic assumption — ADR-0033 D-3).
- **Outside the venue** (venue-agnostic code): the `accountMode` capability — `accountMode.subscribe((s: { isSegregated: boolean }) => void)`. Hyperliquid's `"unifiedAccount"` vocabulary must never leak into `shared/` or `trading/`; those layers see only `{ isSegregated }`.

`dexAbstraction` is the HIP-3 axis and does **not** affect the spot↔perp split → treated as segregated.

## 2a. Perp equity + uPnL are summed across EVERY dex, not read from the single-dex summary

A funded perp position can live on a **HIP-3 (builder-deployed) dex** (`xyz:CL`, `xyz:NVDA`, …), not the main perp dex. `webData2.clearinghouseState` carries the **main dex only** — for an account whose only position is on a HIP-3 dex it reports an empty `assetPositions` and (for unified) a phantom-0 `marginSummary`, so the position's equity and uPnL are **invisible** there. This is the exact bug the positions reader already dodged by sourcing off `allDexsClearinghouseState` instead of webData2.

Therefore **net-worth perp equity and unrealized PnL must be summed over `allDexsClearinghouseState.clearinghouseStates`** (main `''` + every HIP-3 dex), not read from `webData2.clearinghouseState`:

- `perpEquityAllDexes = Σ state.marginSummary.accountValue` over every dex. Per-dex `marginSummary.accountValue` is **real even for unified accounts** — only the AGGREGATE main-dex summary is the phantom-0 of §0. This literal lives in `portfolio-reader.ts` (a sanctioned file, §1) and is summed in **both** the segregated and unified branches.
- `unrealizedPnl = Σ assetPositions[].position.unrealizedPnl` over every dex (`portfolio-reader.ts`, both modes).

The held collateral backing an open position is **netted out of webData2's spot balances** (the spot row reports available-after-maintenance, `hold` zeroed), so spot must stay the webData2 figure and the position's equity is added back via the per-dex `marginSummary.accountValue` — never by switching spot to a gross read (that double-counts the margin).

## 2b. A default account must opt into `dexAbstraction` to TRADE HIP-3, not just read it

§2a is about *reading* HIP-3 equity; this is about *trading* it. A HIP-3 dex holds **isolated collateral** — a classic `default` / `disabled` account's USDC sits in the main perp dex (`''`), so an order on a HIP-3 market is rejected by HL with **"insufficient margin"** even when the main account is funded. The fix is **HIP-3 DEX abstraction** (`userDexAbstraction(enabled:true)`): once set, HL auto-transfers collateral from the main USDC perp / spot into the HIP-3 dex on open and returns it on close — so a default account trades HIP-3 **without** becoming unified / portfolio margin. The mode then reads back as `dexAbstraction`, still **segregated** (§2 — it does not affect the spot↔perp split). `unifiedAccount` / `portfolioMargin` accounts already abstract HIP-3 collateral, so they never need this.

This is surfaced on-demand: the shared `<Hip3AbstractionGateButton>` (fed by the venue's `hip3Abstraction` capability, HL's `Hip3AbstractionProvider`) replaces the Place-Order submit with a one-signature "Enable HIP-3 trading" gate when a default account targets a HIP-3 market. `userDexAbstraction` is SDK-`@deprecated` in favour of `userSetAbstraction`, but that only offers `disabled | unifiedAccount | portfolioMargin` — none of which keep a *default* account — so `dexAbstraction` is the only lever here. See ADR-0081.

## 3. The projected snapshot: `accountValue` is mode-correct, `perpsEquity` is not

`PortfolioReader.subscribeSnapshot(scope, …)` emits a venue-agnostic `PortfolioSnapshot`. `accountValue` is **scope-aware** — and the scope, not just the mode, decides what it means (ADR-0033 D-4, amended):

| `accountValue` | `scope: 'all'` (net worth) | `scope: 'perps'` (perp-tradeable collateral) |
| --- | --- | --- |
| **classic** | all-dexs perp + spot + vault | **main-dex** perp equity (`marginSummary.accountValue`) |
| **unified** | all-dexs perp + spot pool + vault | **spot pool only — vault EXCLUDED** |

The `'all'` (net-worth) perp term is the **all-dexs sum** (§2a) for both modes — it counts HIP-3 positions. The `'perps'` (buying-power) term is the **main-dex** figure only — HIP-3 isolated equity is not main-dex order margin.

`perpsEquity` (the display split) carries the **all-dexs perp equity** — it is **not** "available margin" and **not** the `'perps'`-scope buying-power figure (and is no longer collapsed to `0` for unified — that was the old workaround for the phantom-0 single-dex read). Two further facts make the `'perps'` scope the right read for trading:

- vault / HLP equity is **not order margin** — you can't open a position against it without first withdrawing from the vault — so it must be excluded from any available-to-trade / buying-power figure;
- the portfolio summary **hides** the `'perps'` toggle for unified accounts, so the unified `'perps'` snapshot has exactly two consumers: order-entry's Available-to-Trade and the Tradeable-Funds gate. Both want perp-tradeable collateral, which is why `'perps'` scope excludes vault.

> **Rule:** any consumer asking *"how much can this account trade"* reads **`snapshot.accountValue` under the `'perps'` scope** — never `snapshot.perpsEquity` (now the all-dexs net-worth perp equity, which over-counts HIP-3 isolated margin) and never the `'all'`-scope value (includes vault, over-counts buying power). In classic mode the `'perps'` `accountValue` is the main-dex perp equity. `perpsEquity` / `spotEquity` exist only to render the perps-vs-spot split in the portfolio / equity-card summaries.

## 3b. The write side: a unified account's USDC is spot-held, so move it with the spot action

The phantom-0 trap applies to **actions**, not just displays. A **unified / portfolio-margin** account's USDC physically lives in the **spot** clearinghouse (§0 — `balances-reader` projects its USDC row from `spotState.balances`, `source: 'unified'`; the perp side is ~0). So a money-movement action must target the sub-account where the funds actually are:

- **Withdraw** (`withdraw3` to Arbitrum) reads the cap mode-aware: `'perps'`-scope USDC for segregated, the `'all'`-scope unified USDC for unified (`selectWithdrawableUsdc`, `withdraw-flow.utils.ts`).
- **Send** picks the HL action mode-aware, because USDC has two: `usdSend` debits the **perp** account, `spotSend("USDC:0x…")` debits the **spot** account. A **segregated** account sends perp USDC via `usdSend`; a **unified** account must send its spot-held pooled USDC via **`spotSend`** — `usdSend` targets the phantom-0 perp side and is rejected even when the account is funded (`buildSendableTokens` / `buildUsdcSendableToken`, `send-flow.utils.ts`).

**Rule:** any action that moves a unified account's USDC reads the cap from the `'all'` scope and, where the sub-account matters (Send), routes through the **spot** action — never the perp one. `usdSend` is segregated-only.

## 4. Test fixtures must not conflate the two fields

A `PortfolioSnapshot` test fixture that sets `perpsEquity: accountValue` hides this entire bug class — that is exactly the conflation that let the order-entry `$0` bug ship. Every fixture and helper that builds a funded snapshot must cover **both** shapes:

- classic: `{ accountValue: N, perpsEquity: N }`
- unified: `{ accountValue: N, perpsEquity: 0 }` with `N > 0`

Any consumer of "funded / available-to-trade" needs at least one **unified** fixture asserting the funded figure survives (non-zero buying power / no phantom deposit gate) when `perpsEquity` is `0`.

## Cross-references

- `docs/adr/0033-venue-transfer-capability-and-account-abstraction-mode.md` — mode detection + reader re-routing (D-3, D-4).
- `apps/client/src/modules/hyperliquid/MODULE.md` — `hyperliquid-pull` (`abstractionMode`), `portfolio-reader`, `balances-reader`, `accountMode` capability.
- `apps/client/src/modules/trading/MODULE.md` — order-entry Available-to-Trade collateral + the Tradeable Funds gate (both `portfolio`-capability consumers covered by §3).
