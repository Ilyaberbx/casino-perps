import type { Market } from '../../../shared/domain/domain.types'
import type { MarketSymbol } from './selected-market-provider.types'

// Three arms covering all three market types (see ADR-0016):
// Arm 1 — Perp:  BTC-PERP, ETH-PERP        (uppercase base, literal -PERP)
// Arm 2 — Spot:  HYPE/USDC, PURR/USDC      (exchange-native BASE/QUOTE pair)
// Arm 3 — HIP-3: xyz:AAPL, XYZ:XYZ100      (dex prefix, colon, asset; either case)
const MARKET_SYMBOL_PATTERN =
  /^([A-Z0-9]+-PERP|[A-Z0-9]+\/[A-Z0-9]+|[A-Za-z][A-Za-z0-9]*:[A-Za-z0-9]+)$/

export function isMarketSymbol(value: unknown): value is MarketSymbol {
  return typeof value === 'string' && MARKET_SYMBOL_PATTERN.test(value)
}

export interface ParsedMarketParam {
  readonly venue: 'hl'
  readonly coin: string
}

export function parseMarketParam(raw: string): ParsedMarketParam | null {
  const prefix = 'hl:'
  if (!raw.startsWith(prefix)) return null
  const coin = raw.slice(prefix.length)
  if (!isMarketSymbol(coin)) return null // explicit reject — no silent fallback
  return { venue: 'hl', coin }
}

export function formatMarketParam(symbol: MarketSymbol): string {
  return `hl:${symbol}`
}

/**
 * Builds the `/trade?market=hl:<symbol>` href that selects `symbol` on the
 * trading page. `URLSearchParams` percent-encodes the param value so spot
 * symbols (`HYPE/USDC`) and the `hl:` prefix survive the query string — the same
 * encoding the provider applies when it writes the URL. Used by the global
 * hot-markets ticker, which selects markets via the URL contract (it lives above
 * the /trade route and cannot call `setSelectedMarket` directly).
 */
export function buildTradeMarketHref(symbol: MarketSymbol): string {
  const params = new URLSearchParams({ market: formatMarketParam(symbol) })
  return `/trade?${params.toString()}`
}

const PERP_SUFFIX = '-PERP'

/**
 * Derive the HL `coin` key from a display symbol for the symbol-only fallback
 * `Market` (used before the venue universe has loaded). This is a best-effort
 * convention mirror, NOT the authoritative source — the authoritative `hlCoin`
 * comes from the venue's `listMarkets()` entry and overrides this once loaded:
 *  - Perp:  `BTC-PERP` → `BTC`         (strip the literal suffix)
 *  - HIP-3: `xyz:AAPL` → `xyz:AAPL`    (already the dex-prefixed key form)
 *  - Spot:  `HYPE/USDC` → undefined    (display pair ≠ HL `@N` key; cannot derive)
 *
 * `trading/` may not import the venue's `toHlCoin` (lint-enforced module
 * boundary), hence this local mirror confined to the fallback path.
 */
function deriveFallbackHlCoin(symbol: MarketSymbol): string | undefined {
  if (symbol.endsWith(PERP_SUFFIX)) return symbol.slice(0, -PERP_SUFFIX.length)
  if (symbol.includes('/')) return undefined
  return symbol
}

function deriveFallbackMarketType(symbol: MarketSymbol): Market['marketType'] {
  if (symbol.includes('/')) return 'spot'
  if (symbol.includes(':')) return 'hip3'
  return 'perp'
}

/**
 * Resolve the selected symbol string to its domain `Market`.
 *
 * The authoritative source is the venue's `listMarkets()` snapshot. When the
 * universe is not yet loaded (or the symbol is absent from it), synthesise a
 * minimal symbol-derived `Market` so downstream panels always have a defined
 * `symbol` and never subscribe under a stale/previous-market key. The
 * synthesised market deliberately omits `hlCoin` for spot (un-derivable from
 * the display name) — the caller guards the undefined-key case (D-03).
 */
export function resolveSelectedMarket(
  symbol: MarketSymbol,
  markets: ReadonlyArray<Market>,
): Market {
  const fromUniverse = markets.find((m) => m.symbol === symbol)
  if (fromUniverse !== undefined) return fromUniverse
  return {
    symbol,
    baseAsset: symbol.split(/[-:/]/)[0] ?? symbol,
    quoteAsset: 'USD',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: deriveFallbackMarketType(symbol),
    hlCoin: deriveFallbackHlCoin(symbol),
  }
}
