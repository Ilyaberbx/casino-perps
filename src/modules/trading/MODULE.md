# trading (client)

> **Scope of this file:** non-obvious context only. If something is obvious from `index.ts` or by reading a few files, do NOT add it here. Update this file in the same PR that changes the module's public surface, the things it owns (tables/routes/providers), or its dependencies on other modules.

## Purpose

The **trade screen**. Pick a market (from the lobby / search), size the order, and open a leveraged Hyperliquid perp with a real order ticket: market by default, limit via the price-target toggle, with leverage, margin mode, USD⇄coin sizing off buying power, and the venue's own liquidation + fee estimates shown before you commit.

> **This replaced the casino bet ticket** (bet-amount chips, a "multiplier" slider, UP/DOWN, a confirm sheet whose only number was a prose liquidation warning). The bet ticket is gone, and with it four PRD-0008 decisions — see **Revoked decisions** below. The order ticket that replaced it is the long-standing `order-entry` tree, which had been left unmounted; it was not rewritten.

The screen talks to the active **Venue** through capability ports only (`Trader`, `MarketDataReader`, `CandlesReader`, plus the **`ownAccount`** group — `portfolio` / `perpsPositionsSnapshot` keyed to the **Acting Address**, read for available balance and the open bet so they show the User's own account even while **Spectating**, ADR-0038). It **never imports a venue module** directly (lint-enforced). Order placement + the hidden HL agent setup, and the open-bet Cash Out, both reach the venue via the `Trader` port.

## Public surface

> **Trading Mode (`simple` / `pro`).** The global mode lives in `shared/providers/trading-mode-provider` and is selected in Settings → Trading; `simple` is the default. **Simple ships today** — `TradingPage` renders the market strip + chart + `SimpleOrderTicket`. **Pro is not built yet**: it will restore the orderbook, the recent-trades tape, and the full `OrderEntry` (stop / TWAP / TIF / entry TP/SL), and branch here on `useTradingMode().mode`. `OrderEntry` is complete and tested but currently mounted by nothing — that is deliberate, it is Pro's ticket. Do not delete it.

- `TradingPage` — the route-addressable trade page (mounted by `app/router.tsx`'s `/trade/:symbol`, wrapped in `SelectedMarketProvider → OrderIntentProvider → LeverageMarginProvider`). Renders `TopBar` (market strip), `LazyChart`, and `SimpleOrderTicket`, inside a `FavoritesProvider` (the strip's favourite star reads it). The 3-column app shell and the chat column are owned by `app/AppShell`; `TradingPage` is the centre trade column only. Single responsive column — no separate mobile tree.
- `HotMarketsTicker` — the global-header "hot markets" running row (a seamless CSS marquee of the selected venue's top markets by 24h volume). Mounted by `app/AppShell`. **Route-independent by design:** it reads the venue market universe via the `marketData` capability and selects via the **URL contract** (`useNavigate` → `/trade?market=hl:<symbol>`), **never** consuming `SelectedMarketProvider`. "hot" = top-N by 24h volume via `pickHotMarkets`. Smart hook + dumb sub-components live in `components/hot-markets-ticker/`.
- `MobileTradeDock` / `MobileBottomNav` — the mobile footer nav composite (retained module exports; `MobileBottomNav` is mounted by the app shell). Not mounted by `TradingPage`.
- `MarketSelectionWindow` — the market list, demoted by D15 from primary nav to the app shell's **search overlay**. Internal tree + smart hook; re-exported for the shell to mount.
- `SelectedMarketProvider` — context for the currently selected market. `useSelectedMarketContext()` is `{ selectedMarket: MarketSymbol; setSelectedMarket; market: Market }`: the resolved domain `Market` (carrying `hlCoin` / `marketType` / `stepSize` / `maxLeverage`) is resolved once here from the venue's `listMarkets()`/`subscribeMarkets`. Only the symbol string is persisted to URL/storage.
- `LeverageMarginProvider` — owns the order form's leverage + margin-mode state for the selected market as **shared** state (`useLeverageMargin()`). `applyLeverage` signs the venue `setLeverage`. Seeded from the Acting `perpsPositionsSnapshot`, falling back to 1×/cross.
- `OrderIntentProvider` — the order-intent bus (retained; the former suggestion publisher was deleted). Consumed by `use-order-entry` for prefill; nothing publishes to it today.
- `FavoritesProvider` — persisted favorites set (`useFavorites()`); mounted where the market list needs it.
- `TradeDockProviders` — the context stack (`SelectedMarketProvider → OrderIntentProvider → LeverageMarginProvider`) for pages that host the mobile dock without the `/trade` nesting.
- `MarketSymbol`, `DEFAULT_SELECTED_MARKET` — the cross-module market-symbol type + default.

## Owns

### The trade ticket

- **`components/order-entry/`** — one hook, two tickets. **`use-order-entry`** is the single brain for both: it owns the form, runs `Trader.validateDraft` on every keystroke, prices the draft through `Trader.previewOrder` (notional / margin / liquidation / fee — the venue is the source of truth, never re-derived in the UI), computes buying-power capacity for the % slider + MAX, and submits. It takes an optional `UseOrderEntryOptions` (`initialSizeUnit`, `initialSide`) — a hook argument, not a component prop, so both tickets stay dumb.
  - **`SimpleOrderTicket`** (mounted) — side toggle, leverage + margin mode, available-to-trade, USD⇄coin size with a capacity slider, the pre-trade summary, and the submit gate chain. Its primary button opens **`SimpleReviewSheet`** (position size / margin / liq. price / fee) rather than firing the order; the sheet confirms. Its brain, `use-simple-order-ticket`, is deliberately thin: it adds only the price-target toggle and the review-sheet state.
  - **`OrderEntry`** (Pro; not mounted yet) — the same children plus order-type control (stop / TWAP), time-in-force, reduce-only, entry TP/SL, and the slippage editor.
  - **Simple suppresses Pro's affordances by not rendering them, never by branching in the hook.** Their defaults *are* Simple's semantics: market order, GTC, no reduce-only, no entry TP/SL, venue-default slippage. `buildEntryProtection()` returns `{}` and `isProtectionValid()` returns `true` while protection is disabled, so an unrendered TP/SL section cannot affect `canSubmit` or the submitted order.
  - The **price target** is Simple's only limit affordance: on ⇒ `setOrderType('limit')`. `clearInvalidFields` wipes the limit price on the way back to market, so a stale price can never ride along on a market order (regression-tested).
  - The **submit gate chain** is JSX, not hook state: `ConnectWalletGateButton → VenueOnboardingGateButton → TradeableFundsGateButton → Hip3AbstractionGateButton → SubmitButton`. Both tickets re-compose it; keep the nesting order identical.
- **`__fixtures__/order-entry-venue.ts`** — the shared ticket test harness (fake `Venue` priced against the test's market + mark, wrapped in the spectate / venue / selected-market / leverage / order-intent provider stack). Both hook suites use it so they cannot drift.

### Retained infrastructure

- `SelectedMarketProvider` — the selected-market state + the **URL contract** (`?market=hl:<symbol>` source of truth, `localStorage` fallback; the `/trade/:symbol` path seeds it). Pure helpers `parseMarketParam` / `formatMarketParam` / `buildTradeMarketHref`. Single URL-preferring reconciler effect (no two fighting writers).
- `LeverageMarginProvider` + `use-leverage-margin-state` — shared leverage/margin-mode state; `applyLeverage`/`applyMarginMode` sign the venue controllers and reflect the applied value locally (the stream reconciles). Seeded from the Acting `perpsPositionsSnapshot` (ADR-0038 D-1). `LeverageMargin` is mounted inline by `SimpleOrderTicket` (perps only — spot has no leverage or margin mode).
- `FavoritesProvider` — versioned `localStorage` favorites (`favorites-store.ts`, key `perps-dex-favorites`), `Set<MarketSymbol>`, `reconcileFavorites()` drops delisted symbols.
- **Module-level types/constants** (`trading.types.ts` / `trading.constants.ts` / `trading.utils.ts`) — `MarketCategory` / `MarketCategoryTab` / `MARKET_CATEGORY_TABS`, `MIN_MARKET_VOLUME_USD` (`500_000`), the per-class symbol sets, `getMarketCategory`, and `filterByMinVolume` (the canonical liquidity floor), consumed by the Market Selection window.
- Internal cross-component hooks `use-adapter-stream` (generic stream-reducer, private).
- `components/market-selection-window/` — the MarketSelectionWindow tree (asset-class tabs, liquidity-floored via `filterByMinVolume`), mounted by the app shell's search overlay.

## Depends on

- `shared/domain/` — capability ports + market/order types. Casino Mode uses `Trader` (`validateDraft` → typed `PlaceOrderRequest`, `previewOrder` → `LinearOrderEstimates.liquidationPrice`, `placeOrder`), the `ownAccount` group (`portfolio` for available balance, `perpsPositionsSnapshot` for the open bet), and `marketData` (live mark via `use-live-mark`). `specFromMarket` / `formatPrice` (`shared/utils/format-price`) recover the lot precision and format the liquidation price.
- `shared/providers/venue-provider/` — `useCapability` / `useOwnCapability` narrow the active `Venue`. **`trading/` must never import a venue module** (lint-enforced via `import/no-restricted-paths`).
- `shared/providers/venue-onboarding-provider` — `useVenueOnboarding().runAll` drives the silent HL agent approve-and-register on first bet (D6). Venue-agnostic; the shared provider is fed by `hyperliquid/`'s onboarding at the composition root. `null` when the venue has no onboarding → treated as ready.
- `shared/providers/manage-funds-provider` — `useManageFunds().open('deposit')` is the **Add Cash** action when the confirm-sheet CTA gates to `add-cash` (no balance, D6).
- `account/` — `useAuth().openConnectModal` (the **Create Account** action when disconnected) and `useIsWalletConnected` (the connect gate predicate).
- `shared/components/` — `pixel-button` (UP/DOWN + Cash Out), `Sheet` (the bottom confirm sheet — opens **non-modal** so it sits below Privy's wallet modal), plus the design primitives the retained Market Selection / leverage / chart trees consume.
- `shared/services/toast` — the imperative toast for bet placed / cashed out / failed and the silent-setup failure.
- `shared/utils/generate-cloid` — the client order id threaded into every placed order; the prefix (`ORDER_CLOID_PREFIX`) is reused from `order-entry.constants`.
- `spectate/` — the Acting-vs-Viewing address split: Casino Mode reads its balance + open bet through `useOwnCapability` so they show the User's own account while the rest of the app may be Spectating (ADR-0038).

See `docs/adr/0001-runtime-venue-switching-via-hard-remount.md` (venue swap), `docs/adr/0008-capability-composed-venues.md` (capability composition), `docs/adr/0035-*` (venue-owned order parsing/preview), and `docs/adr/0038-*` (Acting-Address order flow while spectating).

## Gotchas

- **`trading/` must never import a venue module** (`mock-venue/`, `hyperliquid/`, …). It depends on capability ports + the shared venue-agnostic providers (`venue-onboarding-provider`, `manage-funds-provider`) only. Lint-enforced.
- **Never render "agent wallet" / "signing key" / "nonce" / "gas"** (the surviving half of D6 — see Revoked decisions). The vocabulary ban stands; the *silent* onboarding it used to describe does not. Onboarding is now an explicit gate (`VenueOnboardingGateButton`) in the submit chain. Do not reach into `hyperliquid/`'s `agent-wallet-provider` from `trading/` — it is a lint-forbidden venue import; the shared onboarding provider is the seam.
- **Estimates come from the venue, never from the UI.** Notional, margin, liquidation, and fee are read off `Trader.previewOrder`. The casino ticket hand-rolled its own `marginToSize`, which is precisely how sizing drifts from what the venue actually books. Do not reintroduce a local sizing/margin calculation.
- **The review `Sheet` opens non-modally** (`show()`, not `showModal()`) so it sits at `--z-sheet` below Privy's body-level wallet modal — the connect flow must overlay the sheet. jsdom does not implement `<dialog>.show()`; component tests that render the real `Sheet` must stub it.
- A venue switch hard-remounts the trading subtree (ADR-0001) — keep in-page state stateless w.r.t. venue identity, or accept the remount.

## Out of scope

- Identity / onboarding UI (lives in `account/` + `hyperliquid/`).
- Concrete venue implementation (lives in `mock-venue/` and `hyperliquid/`).
- The 3-column shell, chat column, and mobile tab bar (owned by `app/AppShell`).
- Cross-market positions + closed-trade history (lives in `my-bets/`). `trading/`'s per-market position surface is separate.

## Revoked decisions (PRD-0008)

The casino bet ticket is gone; four of its decisions went with it. They are recorded here because this file is the only place they were ever written down, and a reader who follows them now would rebuild the casino.

- **D16 — "liquidation is prose, never a labelled number."** *Revoked.* The pre-trade summary and the review sheet both render **Liq. price** as a number, and `my-bets` renders it per position. A prose warning ("you lose this bet if BTC drops below…") hid the single number a leveraged trader most needs. `formatLiquidationSentence` is deleted.
- **D17 — "market IOC only; no limit / TIF / reduce-only surface."** *Revoked.* Simple is market + an optional limit (the price target). Closes are reduce-only. Pro will add stop / TWAP / TIF.
- **D18 — "the chip is margin; notional is never rendered."** *Revoked.* The review sheet renders **both** margin and position size, sourced from `previewOrder()`. Hiding notional meant hiding how large the position actually was — the number that decides whether the trade is survivable.
- **D6 — silent first-bet onboarding.** *Half revoked.* The submit path now goes through the explicit `VenueOnboardingGateButton`; two competing onboarding paths cannot coexist, and the gate is the tested, capability-correct one. **The vocabulary ban survives** and is listed under Gotchas: never surface "agent wallet" / "nonce" / "gas" to the user.
