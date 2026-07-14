# lobby (client)

> **Scope of this file:** non-obvious context only. If something is obvious from `index.ts` or by reading a few files, do NOT add it here. Update this file in the same PR that changes the module's public surface, the things it owns, or its dependencies on other modules.

## Purpose

The casino **lobby** — the `/` route (PRD 0008 D15). A hero banner over three horizontal poster-card carousels (**Hot Markets** / **New Listings** / **All Markets**), re-skinning the perps market list as a game lobby (yeet-lobby reference). Reading a market card is how a user enters a trade: each card links to `/trade/:symbol`.

## Public surface

- `LobbyPage` — the `/` route component (the only export in `index.ts`). Smart container: calls `useLobby`, renders `HeroBanner` + one `MarketCarousel` per section. Takes no props.

Everything else — `useLobby`, `HeroBanner`, `MarketCarousel`, the `market-card` sub-component, and all utils — is **private** to the module. The router imports only `LobbyPage`.

## Owns

- **`market-card/`** — the poster card (`MarketCard`, `MarketCardSkeleton`) and its gradient/ticker/logo derivations. 3:4 neon poster with a deterministic gradient, centered token logo (initials fallback), ticker, and win/loss 24h chip.
- **`utils/`** — pure, unit-tested helpers: `symbol-gradient` (deterministic neon gradient), `symbol-ticker` (display ticker + initials), `symbol-logo-url` (`symbolLogoCandidates` — the shared icon-URL ladder for a symbol), `format-change-pct`, `build-lobby-sections` (universe → Hot/New/All buckets), `carousel-paging` (arrow availability + page-scroll math), `trade-href` (the `/trade/:symbol` route href).
- **Section policy** (`lobby.constants.ts`): Hot = top 12 by 24h volume; New = newest 12 by listing-order proxy (see gotchas); All = the rest. `build-lobby-sections` guarantees the three buckets are **disjoint**.
- No DB tables, no API routes, no ports/adapters, no providers — a leaf UI module.

## Depends on

- **`@/modules/shared/providers/venue-provider`** — `useVenueOptional`, then the **`marketData`** capability port (`listMarkets` / `subscribeMarkets`) read via `useSyncExternalStore`. This is the **only** way the lobby gets markets; it never imports `@/modules/hyperliquid` (or any venue module) directly.
- **`@/modules/shared/domain`** — the `Market` / `MarketDataReader` types.
- **`@/modules/shared/hooks/use-prefers-reduced-motion`** — the carousel pages with `scrollTo({ behavior: 'smooth' })`, degraded to `'auto'` under reduced motion.
- `react-router-dom` (`Link` for card + "See all" navigation), `lucide-react` (section + arrow icons), and the casino palette CSS variables (`--bg-*`, `--accent-*`, `--win`, `--loss`, `--text-*`, `--font-*`).

## Cross-app contract

None — client-only. All data flows through the venue `marketData` port; there is no lobby-specific server surface.

## Gotchas

- **There is no LIVE WINS ticker.** It was removed when the trade page became a real trading surface (see `social/MODULE.md`). The lobby must not reintroduce one. `HeroBanner` is a plain teal panel, not a ticker. The lobby must also never render a second `ChatPanel` — the shell owns it.
- **"New Listings" is a proxy, not a dated field.** The domain `Market` has no `listedAt`/`createdAt`, so there is nothing to sort "new" by. `listMarkets()` returns perps in Hyperliquid **universe-append order** (a newly listed asset is appended to the tail), so `build-lobby-sections` takes the *tail* of the native order (excluding Hot) as the newest signal. This is deliberately a listing-order proxy — it is **never** volume-sorted data relabelled as "new". If the venue later exposes a real listing timestamp, switch New Listings to sort by it. (Reported as a blocker for this build.)
- **`change24hPct` is a fraction on `Market`, a percentage on the card.** `MarketCard` wants `2.4`; `Market.change24hPct` is `0.024`. `MarketCarousel` multiplies by 100 at the seam (`toChangePct`).
- **"See all" points at `/trade`.** There is no per-category route; the trade screen hosts the full searchable market list, so it is the closest "see all" surface.
- **Card navigation is a `<Link>`, not the hook.** `useLobby` deliberately holds no navigation — cards are `<Link to={tradeHref(symbol)}>` so open-in-new-tab and middle-click work. HIP-3 symbols (`xyz:AAPL`) are percent-encoded in the path segment; the router decodes them back.
- **Carousel arrows disable at the ends** from live DOM scroll geometry (`scroll` + `ResizeObserver`). The math is the pure `carousel-paging` util; in jsdom (zero layout) both arrows read as disabled.

## Out of scope

- The LIVE WINS ticker and Live Chat — the `social/` module + the `app/` shell own those.
- The `/trade` screen, market selection, and order entry — the `trading/` module.
- Any real "New Listings" recency until the venue surfaces a listing timestamp.
