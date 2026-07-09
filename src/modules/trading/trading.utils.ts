import type { Market } from '@/modules/shared/domain'
import {
  COMMODITIES_SYMBOLS,
  FX_SYMBOLS,
  INDICES_SYMBOLS,
  PRE_IPO_SYMBOLS,
  STOCKS_SYMBOLS,
} from './trading.constants'
import type { ChangeDisplay, MarketCategory } from './trading.types'

/** Symbol → non-crypto category lookup, built once from the explicit sets.
 *  Crypto is intentionally absent — it is the default for any miss. */
const CATEGORY_BY_SYMBOL: ReadonlyMap<string, MarketCategory> = new Map<
  string,
  MarketCategory
>([
  ...STOCKS_SYMBOLS.map((s): [string, MarketCategory] => [s, 'stocks']),
  ...COMMODITIES_SYMBOLS.map((s): [string, MarketCategory] => [s, 'commodities']),
  ...INDICES_SYMBOLS.map((s): [string, MarketCategory] => [s, 'indices']),
  ...FX_SYMBOLS.map((s): [string, MarketCategory] => [s, 'fx']),
  ...PRE_IPO_SYMBOLS.map((s): [string, MarketCategory] => [s, 'pre-ipo']),
])

/**
 * The asset-class category for a base-asset symbol — Minara's 1:1 tabs. Matches
 * case-insensitively against the non-crypto sets; everything else is `crypto`
 * (the default bucket). Pure — no React, no I/O, no module state.
 */
export function getMarketCategory(symbol: string): MarketCategory {
  return CATEGORY_BY_SYMBOL.get(symbol.trim().toUpperCase()) ?? 'crypto'
}

/**
 * Drops illiquid dust: keeps only markets at or above `minVolumeUsd` 24h notional
 * (absent volume counts as 0 → dropped). The canonical liquidity floor shared by
 * BOTH the market-selection window and the AI-suggestion token list, so the two
 * surfaces can never disagree on which venue markets are tradeable (ADR-0064,
 * amending ADR-0062). Pure — no React, no I/O, no module state.
 */
export function filterByMinVolume(markets: Market[], minVolumeUsd: number): Market[] {
  return markets.filter((m) => (m.volume24h ?? 0) >= minVolumeUsd)
}

/**
 * Formats a USD amount as a compact, human-readable string with a B/M/K
 * suffix (`$2.13B`, `$1.04M`, `$5.00K`), falling back to `$x.xx` below 1000.
 * Two decimal places throughout. Shared by the top-bar market strip and the
 * market-selection-window rows so both read the same.
 *
 * Pure function — no React, no I/O, no module state.
 */
export function formatCompactUsd(value: number): string {
  const isBillion = value >= 1_000_000_000
  if (isBillion) return `$${(value / 1_000_000_000).toFixed(2)}B`
  const isMillion = value >= 1_000_000
  if (isMillion) return `$${(value / 1_000_000).toFixed(2)}M`
  const isThousand = value >= 1_000
  if (isThousand) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

/**
 * Projects the signed-fraction `change24hPct` (0.05 = +5%) into a presentation
 * ready `{ display, direction }`: the percent is rendered ×100 to two decimals,
 * positives carry an explicit `+`, and the direction colours the cell. The
 * canonical 24h-change formatter shared by the market-selection-window rows and
 * the hot-markets ticker so both never drift.
 *
 * Pure function — no React, no I/O, no module state.
 */
export function deriveChangeDisplay(change24hPct: number): ChangeDisplay {
  const changePercent = change24hPct * 100
  const isPositive = change24hPct > 0
  const isNegative = change24hPct < 0
  const direction = isPositive ? 'up' : isNegative ? 'down' : 'neutral'
  const display = isPositive ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`
  return { display, direction }
}

/**
 * Reconciles the user's stored favorite symbols against the current live
 * market list (WL-03). Returns a new Set containing only those stored symbols
 * that still exist in `liveMarkets`. The input set is never mutated.
 *
 * Pure function — no React, no I/O, no module state.
 */
export function reconcileFavorites(
  storedSymbols: ReadonlySet<string>,
  liveMarkets: Market[],
): Set<string> {
  const liveSet = new Set(liveMarkets.map((m) => m.symbol))
  return new Set([...storedSymbols].filter((sym) => liveSet.has(sym)))
}
