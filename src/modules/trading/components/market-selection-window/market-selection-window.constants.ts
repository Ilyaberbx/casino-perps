/**
 * The selection window's tabs are now asset-class categories — a 1:1 copy of
 * Minara (All / Crypto / Stocks / Commodities / Indices / FX / Pre-IPO),
 * replacing the former market-TYPE tabs (ADR-0014 amendment, ADR-0062). The tab
 * list itself is owned at the module root (`trading.constants`) since both this
 * window and the AI-suggestion Market field share it.
 */
export { MARKET_CATEGORY_TABS } from '../../trading.constants'

/**
 * Category pills for re-sorting the visible market list.
 * Popular = curated priority, Hot = volume, Gainers/Losers = signed 24h%.
 */
export const CATEGORY_PILLS = [
  { label: 'POPULAR', value: 'popular' },
  { label: 'HOT', value: 'hot' },
  { label: 'GAINERS', value: 'gainers' },
  { label: 'LOSERS', value: 'losers' },
] as const

export const DEFAULT_MARKET_CATEGORY_TAB = 'all' as const

export const DEFAULT_CATEGORY_PILL = 'popular' as const

// Max rows the pre-measurement fallback in MarketList renders before the
// virtualizer's ResizeObserver reports a real window. Bounds the single
// pre-measurement frame (and jsdom, which never measures) so a real-browser
// open never paints the full ~600-market universe un-virtualized. ADR-0019.
export const FALLBACK_ROW_CAP = 40

// Curated symbol order for the 'popular' pill sort. Markets not in this list
// sort after the curated set (tiebreak: volume desc).
// AUTO-RESOLVED in Plan 06-03: MATIC-PERP removed (rebranded to POL; negligible
// Hyperliquid volume) and HYPE-PERP added after SOL (Hyperliquid flagship perp,
// highest editorial relevance). See 06-03-SUMMARY.md for full rationale.
// This list remains a product/editorial decision — edit freely without code changes.
export const POPULAR_ORDER: readonly string[] = [
  'BTC-PERP',
  'ETH-PERP',
  'SOL-PERP',
  'HYPE-PERP',
  'ARB-PERP',
  'BNB-PERP',
  'AVAX-PERP',
  'OP-PERP',
  'DOGE-PERP',
  'LINK-PERP',
] as const
