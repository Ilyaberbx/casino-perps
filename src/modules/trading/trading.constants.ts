/**
 * Sentinel subscription key passed into a panel hook when the resolved
 * `Market` has no usable `hlCoin` yet (universe not loaded, or spot display
 * symbol whose `@N` key is un-derivable). The venue never resolves this key,
 * so the hook's `useAdapterStream({ resetOnSubscribe: true })` stays in its
 * `initial` (loading/empty) state rather than subscribing under a stale or
 * wrong key (D-03 — explicit loading, never stale).
 */
export const SUBSCRIPTION_KEY_NONE = ''

/**
 * localStorage key for the user's persisted favorite market symbols.
 * Payload shape: { version: 1, symbols: string[] } (WL-01).
 */
export const FAVORITES_STORAGE_KEY = 'perps-dex-favorites'

/**
 * Asset-class symbol sets — Minara's market-browser categorisation, scraped 1:1
 * (the partition is exact: every market falls in exactly one category; see
 * `docs/adr/0062-minara-market-catalog.md` and the verification artifact
 * `screenshots/minara-catalog-final.json`). Values are base-asset symbols,
 * uppercase. Any symbol NOT in one of these five sets is `crypto` — the default
 * bucket — so the much larger crypto list is not duplicated here.
 *
 * These sets are the single source of truth for `getMarketCategory`
 * (trading.utils.ts), which drives both the Market Selection Window tabs and the
 * AI-suggestion Market field grouping. Editorial data — edit freely.
 */
export const STOCKS_SYMBOLS = [
  'MU', 'NVDA', 'SKHX', 'GOOGL', 'SNDK', 'MRVL', 'INTC', 'DRAM', 'MSFT', 'CRCL',
  'TSLA', 'MSTR', 'META', 'SMSN', 'AMZN', 'AMD', 'HOOD', 'ORCL', 'PLTR', 'CRWV',
  'AAPL', 'LITE', 'RKLB', 'PURRDAT', 'EWY', 'TSM', 'COIN', 'HIMS', 'BABA', 'LLY',
  'NFLX', 'GME', 'HYUNDAI', 'RIVN', 'URNM', 'USAR', 'EWJ', 'ZM', 'BIRD', 'XLE',
  'COST', 'DKNG', 'EWZ', 'BX',
] as const

export const COMMODITIES_SYMBOLS = [
  'CL', 'GOLD', 'BRENTOIL', 'SILVER', 'COPPER', 'NATGAS', 'PLATINUM', 'PALLADIUM',
] as const

export const INDICES_SYMBOLS = ['SP500', 'XYZ100', 'JP225', 'KR200'] as const

export const FX_SYMBOLS = ['JPY', 'EUR'] as const

export const PRE_IPO_SYMBOLS = ['SPCX', 'CBRS', 'QNT'] as const

/**
 * Asset-class tabs for the Market Selection Window and the AI-suggestion Market
 * field, in Minara's display order. `'all'` is the unfiltered tab; the rest are
 * the `MarketCategory` values. (Replaces the former market-TYPE tabs — see
 * `docs/adr/0014-*` amendment.)
 */
export const MARKET_CATEGORY_TABS = [
  { label: 'ALL', value: 'all' },
  { label: 'CRYPTO', value: 'crypto' },
  { label: 'STOCKS', value: 'stocks' },
  { label: 'COMMODITIES', value: 'commodities' },
  { label: 'INDICES', value: 'indices' },
  { label: 'FX', value: 'fx' },
  { label: 'PRE-IPO', value: 'pre-ipo' },
] as const

/**
 * Markets below this 24h notional volume (USD) are hidden from the Market
 * Selection Window — drops illiquid spot dust while keeping the liquid spot
 * assets. See the ADR-0014 amendment.
 */
export const MIN_MARKET_VOLUME_USD = 500_000
