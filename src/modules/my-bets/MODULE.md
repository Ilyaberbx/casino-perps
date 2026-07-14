# my-bets (client)

> **Scope of this file:** non-obvious context only. Update it in the same PR that changes the module's public surface, what it owns, or its dependencies.

## Purpose

The `/my-bets` **Page** — the account's cross-market position surface (it stands in for the deleted `portfolio/` page). Three stacked regions: **Account value** (equity + Deposit / Withdraw), **Open Positions** (with a Close), and **Trade History** (closed trades). No equity chart, no tile grid — `chart.js` / `react-chartjs-2` were dropped with the portfolio page.

> The casino vocabulary here (bet / Cash Out / multiplier / profit·loss, and the prose-only liquidation of PRD-0008 D16) has been **removed**: rows now read LONG/SHORT, leverage, PnL, and a labelled **Liq. price**. The route is still `/my-bets` and the module folder is still `my-bets/`; both are renamed to `positions` in a follow-up. See `trading/MODULE.md` → Revoked decisions.

## Public surface

- `MyBetsPage` — the route-addressable page. Mounted lazily by `app/router.tsx` at `/my-bets` (`lazy: () => import('@/modules/my-bets')`), so the module must stay the code-split boundary.

## Owns

- Page composition (`pages/MyBetsPage.tsx`) and its orchestrating hook (`pages/use-my-bets-page.ts`), which composes three colocated single-consumer hooks:
  - `pages/use-cash-balance.ts` — YOUR CASH as a thin casino-vocabulary alias over `account/`'s `useOwnEquity` (Acting-Address-keyed equity; disconnected ⇒ `0`); the app-shell balance chip reads the same hook.
  - `pages/use-open-positions.ts` — open positions from the own-account `PerpsPositionsSnapshotReader`, projected with each market's ticker + liquidation-price precision; owns Close (reduce-only full-size market close via the `Trader` port) and its per-symbol in-flight state.
  - `pages/use-settled-bets.ts` — settled history accumulated from the `FillsReader` (each close fill with a `closedPnl`), newest-first, capped at `SETTLED_BETS_LIMIT`.
- Dumb components (not exported): `components/cash-header/`, `components/live-bets/` (`LiveBetsSection` + `LiveBetRow`), `components/settled-bets/` (`SettledBetsSection` + `SettledBetRow`).
- Pure projection/formatting in `my-bets.utils.ts` (`projectLiveBet`, `buildFullCloseRequest`, `mergeSettledBet`, `formatLiquidationSentence`, `tickerFromSymbol`, …) and `my-bets.constants.ts` (`CASH_OUT_CLOID_PREFIX`, `SETTLED_BETS_LIMIT`).

## Depends on

- `shared/providers/venue-provider/` — `useOwnCapability('portfolio' | 'perpsPositionsSnapshot')` (Acting-Address-keyed, shows self even while Spectating), `useCapability('trader')`, `useCapabilityOptional('marketData' | 'fills')`.
- `shared/domain/` — `PerpPositionSnapshot`, `PlaceOrderRequest`, `PortfolioSnapshot`, `Market`, `Fill`, `Side`.
- `shared/providers/manage-funds-provider/` — `useManageFunds().open('deposit' | 'withdraw')` backs Add Cash / Withdraw. Mounted around the router Outlet in `app/app-shell/AccountSessionRoot.tsx`.
- `shared/utils/format-number` (`formatUsd`), `shared/utils/format-price` (`formatPrice`, `specFromMarket`), `shared/utils/generate-cloid`, `shared/services/toast`.
- `account/` — `useIsWalletConnected` (empty-value wallet gate for YOUR CASH; hides the money-movement buttons while disconnected).

## Gotchas

- **Close is a reduce-only market order** for the opposite side and full size (`buildFullCloseRequest`). `trading/` will grow its own per-market close (position panel); if it does, the two builders are intentional twins — keep them in sync. They stay duplicated rather than shared because `trading/`'s internals are not on its public surface and cross-module deep imports are lint-forbidden.
- **Liquidation prose needs the market.** `marketData` is optional here — when a position's market has not resolved, the prose degrades to the honest "moves too far against you" fallback and the price formats at a 2dp default. Never render the liquidation as a labelled number (D16).
- **SETTLED is fills-derived**, so while Spectating it would reflect the Spectated Address's fills (`FillsReader` is viewing-keyed; there is no own-account fills reader). Live bets and cash use own-account readers, so they always show self.

## Out of scope

- Placing bets, the price chart, the confirm sheet (all live in `trading/`).
- The equity chart / analytics tiles (deleted with the portfolio page).
- Money-movement UI itself (owned by the shared Manage Funds surface; this page only opens it).
