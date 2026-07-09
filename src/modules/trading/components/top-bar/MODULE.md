# top-bar (trading module component)

> **Scope of this file:** non-obvious context only. Update in the same PR that changes this component's public surface, what it owns, or its cross-module dependencies.

## Purpose

The sticky market info strip at the top of the trading view. Renders the selected-market icon, symbol dropdown, real-time ticker stats (mark price, 24h change, 24h volume, oracle, open interest, funding), and a favorite-star toggle.

## Public surface

`TopBar` is exported from `trading/index.ts`. No other exports are public; hooks, sub-components, utils, constants, and types are module-internal.

## Owns

- DOM region: the top strip of the trading layout (above the chart).
- No DB tables or API routes (client-only component).
- Internal state: favorites set (ephemeral — not persisted across sessions).

## Depends on

- `useSelectedMarketContext()` from `trading/providers/selected-market-provider` — provides `selectedMarket` (MarketSymbol string) and `market` (resolved `Market` domain object).
- `useCapability('marketData')` from `@/modules/shared/providers/venue-provider` — narrows the venue to the required `marketData` reader for live market list subscription.
- `useTicker(hlCoin)` — local hook for real-time mark-price / funding data via the venue's ticker feed.
- `@/modules/shared/components/asset-icon` — `AssetIcon` component (Phase 4; imported in `TopBar.tsx`). Renders the selected market's CDN icon or a letter placeholder.

## Gotchas

- **Responsive layout split.** `TopBar` is a thin branch: it calls `useTopBar()` (which now also returns `isMobile` from `shared/hooks/use-is-mobile`) and renders one of two dumb views with the same prop slice (`TopBarViewProps`). `TopBarDesktop` is the single horizontal strip (`.container` + `TickerStats`); `TopBarMobile` is the stacked layout — identity row over a prominent mark price + 24h change (`MobileTickerStrip`), with the remaining stats (Oracle / 24h Vol / OI / Funding) in a horizontal-scroll strip. The two views share `FavoriteStar` / `MarketDropdownButton` / `MarketSelectionWindow`; only the stats presentation differs. Keep both flash paths (`.statValuePrice` desktop, `.mobilePrice` mobile) in the `prefers-reduced-motion` block.
- `selectedMarket` (the string symbol) and `market` (the resolved `Market` object) are both returned from `useTopBar()`. `AssetIcon` receives `market` (the object), not `selectedMarket` (the string). The `hasResolvedMarket` guard in `TopBar.tsx` ensures no crash if the resolved `Market` is unexpectedly absent.
- The `.iconSlot` CSS class reserves a fixed 20×20 px slot so the strip does not reflow when the icon loads or fails (CLS = 0 invariant).
- `deriveMarketStripStats` is a pure transform in `top-bar.utils.ts` — it does not call the venue directly.

## Out of scope

- Order placement — lives in the order-entry component.
- Position display — lives in the account-dock component.
- Market search / selection overlay — planned for Phase 6 market-selection-window.
