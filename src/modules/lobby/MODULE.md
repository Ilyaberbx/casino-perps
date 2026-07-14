# lobby (client)

> **Scope of this file:** non-obvious context only. If something is obvious from `index.ts` or by reading a few files, do NOT add it here. Update this file in the same PR that changes the module's public surface, the things it owns, or its dependencies on other modules.

## Purpose

The casino **lobby** — the `/` route (PRD 0008 D15). A hero banner over three horizontal poster-card carousels (**Hot Markets** / **New Listings** / **All Markets**), re-skinning the perps market list as a game lobby (yeet-lobby reference). Reading a market card is how a user enters a trade: each card links to `/trade/:symbol`.

## Public surface

- `LobbyPage` — the `/` route component. Smart container: calls `useLobby`, then renders **either** `HeroBanner` + one `MarketCarousel` per section (the `all` view) **or** a single `MarketGrid` (a focused view). Takes no props.
- `LobbyView` / `parseLobbyView` / `LOBBY_VIEW_PARAM` / `DEFAULT_LOBBY_VIEW` — the `?view=` contract, below. Public because the **app shell's left rail** both writes these URLs and highlights the active item from them; it must not restate the union or re-roll the parsing.

Everything else — `useLobby`, `HeroBanner`, `MarketCarousel`, `MarketGrid`, the `market-card` sub-component, and all other utils — is **private** to the module.

## The `?view=` contract

The left rail (`app/app-shell/left-rail/`) links every lobby item to `/` with a `?view=` param. The lobby reads it and renders accordingly:

| `?view=` | renders |
| --- | --- |
| `all`, absent, **or anything unrecognised** | hero + the Hot / New / All carousels |
| `hot`, `new` | a `MarketGrid` of that carousel's bucket |
| `favorites` | a `MarketGrid` of the starred markets |
| `recent` | a `MarketGrid` of the markets most recently opened |

`parseLobbyView` is the **only** thing that turns a URL into a `LobbyView`, and both the rail and `useLobby` call it — so the highlighted rail item and the rendered page can never disagree. An unknown `?view=bogus` therefore falls back to `all` in both, instead of rendering a blank page with nothing highlighted.

> **History:** the rail wrote `?view=` from day one, but nothing on the lobby side ever read it — every lobby item rendered the identical screen, and `favorites` / `recent` pointed at features that did not exist. That is the bug this contract closes.

## Owns

- **`market-card/`** — the poster card (`MarketCard`, `MarketCardSkeleton`) and its gradient/ticker/logo derivations. 3:4 neon poster with a deterministic gradient, centered token logo (initials fallback), ticker, and win/loss 24h chip.
- **`market-grid/`** — `MarketGrid`, the focused-view counterpart to `MarketCarousel`: same cards, same `/trade/:symbol` links, but a wrapping grid instead of a scroll strip — no arrows, no "See all" (a focused view *is* the see-all), and per-view empty copy.
- **`utils/`** — pure, unit-tested helpers: `symbol-gradient` (deterministic neon gradient), `symbol-ticker` (display ticker + initials), `symbol-logo-url` (`symbolLogoCandidates` — the shared icon-URL ladder for a symbol), `format-change-pct`, `build-lobby-sections` (universe → Hot/New/All buckets), `parse-lobby-view` (URL → `LobbyView`), `select-view-markets` (favorites/recent ∩ live universe), `to-change-pct` (the fraction→percent card seam), `carousel-paging` (arrow availability + page-scroll math), `trade-href` (the `/trade/:symbol` route href).
- **Section policy** (`lobby.constants.ts`): Hot = top 12 by 24h volume; New = newest 12 by listing-order proxy (see gotchas); All = the rest. `build-lobby-sections` guarantees the three buckets are **disjoint**.
- No DB tables, no API routes, no ports/adapters, no providers — a leaf UI module.

## Depends on

- **`@/modules/shared/providers/venue-provider`** — `useVenueOptional`, then the **`marketData`** capability port (`listMarkets` / `subscribeMarkets`) read via `useSyncExternalStore`. This is the **only** way the lobby gets markets; it never imports `@/modules/hyperliquid` (or any venue module) directly.
- **`@/modules/trading`** (public API only) — `useFavoritesOptional` and `useRecentMarketsOptional`, for the two persisted views. The **optional** variants are deliberate, for the same reason as `useVenueOptional`: the lobby must degrade to an empty view under a test harness or a pre-provider paint, never throw. Both providers are mounted app-wide in `AccountSessionRoot`.
- **`@/modules/shared/domain`** — the `Market` / `MarketDataReader` types.
- **`@/modules/shared/hooks/use-prefers-reduced-motion`** — the carousel pages with `scrollTo({ behavior: 'smooth' })`, degraded to `'auto'` under reduced motion.
- `react-router-dom` (`Link` for card + "See all" navigation), `lucide-react` (section + arrow icons), and the casino palette CSS variables (`--bg-*`, `--accent-*`, `--win`, `--loss`, `--text-*`, `--font-*`).

## Cross-app contract

None — client-only. All data flows through the venue `marketData` port; there is no lobby-specific server surface.

## Gotchas

- **There is no LIVE WINS ticker.** It was removed when the trade page became a real trading surface (see `social/MODULE.md`). The lobby must not reintroduce one. `HeroBanner` is a plain teal panel, not a ticker. The lobby must also never render a second `ChatPanel` — the shell owns it.
- **"New Listings" is a proxy, not a dated field.** The domain `Market` has no `listedAt`/`createdAt`, so there is nothing to sort "new" by. `listMarkets()` returns perps in Hyperliquid **universe-append order** (a newly listed asset is appended to the tail), so `build-lobby-sections` takes the *tail* of the native order (excluding Hot) as the newest signal. This is deliberately a listing-order proxy — it is **never** volume-sorted data relabelled as "new". If the venue later exposes a real listing timestamp, switch New Listings to sort by it. (Reported as a blocker for this build.)
- **`change24hPct` is a fraction on `Market`, a percentage on the card.** `MarketCard` wants `2.4`; `Market.change24hPct` is `0.024`. `MarketCarousel` multiplies by 100 at the seam (`toChangePct`).
- **"See all" points at the section's focused grid** (`/?view=hot`), passed in as `seeAllHref` by the page. The "All Markets" row passes `null` and renders no link — it is already the full remainder, so it has nowhere to go. (It used to hardcode `/trade`, back when the lobby had no per-section route.)
- **Focused Hot / New reuse the exact `buildLobbySections` buckets** (12 / 12, disjoint). There is deliberately no separate focused-view limit: one section policy, one place. Bump `HOT_MARKET_LIMIT` / `NEW_LISTINGS_LIMIT` and both the carousel and the grid move together.
- **Favorites render in universe order; Recent renders in recency order.** Favorites' `Set` does preserve insertion order, but that order is meaningless after a `reconcileFavorites` pass or the legacy bare-`string[]` migration — universe order is stable and matches the "All Markets" row. Recency is Recent's job.
- **Both persisted views intersect with the live universe at read time** (`select-view-markets`), so a delisted symbol silently drops out. This is why the Recent *write* path never needs to reconcile against delistings.
- **Card navigation is a `<Link>`, not the hook.** `useLobby` deliberately holds no navigation — cards are `<Link to={tradeHref(symbol)}>` so open-in-new-tab and middle-click work. HIP-3 symbols (`xyz:AAPL`) are percent-encoded in the path segment; the router decodes them back.
- **Carousel arrows disable at the ends** from live DOM scroll geometry (`scroll` + `ResizeObserver`). The math is the pure `carousel-paging` util; in jsdom (zero layout) both arrows read as disabled.

## Out of scope

- The LIVE WINS ticker and Live Chat — the `social/` module + the `app/` shell own those.
- The `/trade` screen, market selection, and order entry — the `trading/` module.
- Any real "New Listings" recency until the venue surfaces a listing timestamp.
