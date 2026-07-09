import type { Market, MarketType } from '@/modules/shared/domain/domain.types'
import { TRADINGVIEW_LOGOID_MAP } from '@/modules/shared/constants/tradingview-logoid-map.constants'
import { getMarketKindFromSymbol } from '@/modules/shared/utils/get-market-kind'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'

/**
 * The single source of truth for an **icon-only** synthetic `Market` — the
 * minimal shape that feeds `resolveMarketIconUrl` / `AssetIcon` where the caller
 * has a base asset + market type but no real venue `Market`. Used by the AI
 * suggestion catalog tokens and the account-dock snapshot rows (positions /
 * orders carry only a `symbol`), so every surface renders the same icon the same
 * way. `venue` / `tickSize` / `stepSize` are unused by the resolver; the
 * placeholder values just satisfy the `Market` shape. Do NOT re-derive this
 * shape inline — call this helper.
 */
export function buildIconMarket(baseAsset: string, marketType: MarketType): Market {
  return {
    symbol: baseAsset,
    baseAsset,
    quoteAsset: 'USDC',
    venue: 'icon-only',
    tickSize: 0,
    stepSize: 0,
    marketType,
  }
}

/**
 * The icon base asset for a raw venue symbol — the segment `AssetIcon` resolves
 * a logo for. Strips the HIP-3 dex prefix (`xyz:NVDA` → `NVDA`, via
 * `parseHip3Symbol`) then the spot quote (`BTC/USDC` → `BTC`). Plain perp
 * symbols pass through unchanged.
 */
function iconBaseAssetFromSymbol(symbol: string): string {
  const { displaySymbol } = parseHip3Symbol(symbol)
  const slashIndex = displaySymbol.indexOf('/')
  if (slashIndex === -1) return displaySymbol
  return displaySymbol.slice(0, slashIndex)
}

/**
 * Builds an icon-only `Market` straight from a raw venue symbol string — the
 * common case for account-dock snapshot rows, which carry only a `symbol`
 * (`'BTC'`, `'xyz:NVDA'`, `'PURR/USDC'`). Derives the market kind from the symbol
 * shape (`getMarketKindFromSymbol`) and the base asset by stripping the HIP-3 dex
 * prefix / spot quote, then defers to `buildIconMarket`. Do NOT re-derive inline.
 */
export function buildIconMarketFromSymbol(symbol: string): Market {
  const marketType = getMarketKindFromSymbol(symbol)
  const baseAsset = iconBaseAssetFromSymbol(symbol)
  return buildIconMarket(baseAsset, marketType)
}

/**
 * Discriminated union representing the primary icon URL for a Market.
 * - 'tv': TradingView symbol-logo CDN — primary for HIP-3 (equities/commodities/
 *   indices/FX), fallback for crypto.
 * - 'hl': Hyperliquid CDN URL — primary for crypto (perp/spot); coin-correct
 *   because it is keyed by Hyperliquid's own coin id.
 * - 'placeholder': no URL available; render the letter placeholder
 *
 * Also exported from asset-icon.types.ts for consumption by the AssetIcon
 * component folder.
 */
export type IconResolution =
  | { kind: 'tv'; url: string }
  | { kind: 'hl'; url: string }
  | { kind: 'placeholder' }

const TV_CDN_BASE = 'https://s3-symbol-logo.tradingview.com'
const HL_CDN_BASE = 'https://app.hyperliquid.xyz/coins'

// Widen the generated `as const` map so it can be indexed by an arbitrary
// runtime symbol string without literal-key narrowing fighting the lookup.
const LOGOID_BY_SYMBOL: Readonly<Record<string, string>> = TRADINGVIEW_LOGOID_MAP

/**
 * True for crypto markets (perp / spot), false for HIP-3 (equities, commodities,
 * indices, FX). `hip3` is the only non-crypto `marketType`; an absent type is
 * treated as crypto (the mock venue / icon-only markets default to perp). This
 * is the single predicate that decides icon-source order — see
 * `resolveMarketIconUrl` and `use-asset-icon.ts`.
 */
export function isCryptoMarket(market: Market): boolean {
  return market.marketType !== 'hip3'
}

/**
 * Normalizes a coin identifier to a CDN-compatible filename stem for the
 * **Hyperliquid** fallback.
 *
 * - Market-type suffix: strip a trailing '-PERP' / '-SPOT' (e.g. 'BTC-PERP' →
 *   'BTC'). The mock venue sets `hlCoin === symbol` ('BTC-PERP'), so without this
 *   the HL fallback requested 'BTC-PERP.svg' — which HL's CDN answers with its
 *   SPA `index.html` (200 text/html), failing the `<img>` decode.
 * - k-prefix perps: strip a single leading lowercase 'k' (e.g. 'kBONK' → 'BONK')
 * - Trailing digits: strip for re-listed coins (e.g. 'BTC2' → 'BTC')
 */
function normalizeCoinStem(coin: string): string {
  const suffixStripped = coin.replace(/-(PERP|SPOT)$/i, '')
  const kPrefixStripped = suffixStripped.replace(/^k([A-Z])/, '$1')
  return kPrefixStripped.replace(/\d+$/, '')
}

/**
 * The TradingView logoid for a market, or null when none is mapped. Tries the
 * raw uppercase base asset first (so symbols whose own form is the key — 'AAPL',
 * 'SP500', '0G' — hit directly and are never digit-stripped), then the
 * normalized crypto stem (so the mock venue's 'BTC-PERP' base and legacy
 * suffixed bases still resolve 'BTC').
 */
function resolveTvLogoid(market: Market): string | null {
  const rawSymbol = market.baseAsset.toUpperCase()
  const directLogoid = LOGOID_BY_SYMBOL[rawSymbol]
  if (directLogoid) return directLogoid

  const stemSymbol = normalizeCoinStem(market.baseAsset).toUpperCase()
  const isStemDistinct = stemSymbol.length > 0 && stemSymbol !== rawSymbol
  if (!isStemDistinct) return null

  const stemLogoid = LOGOID_BY_SYMBOL[stemSymbol]
  return stemLogoid ?? null
}

/**
 * The TradingView icon URL for a market, or null when no logoid is mapped.
 * Primary source for HIP-3, crypto fallback (TV's `crypto/XTVC{SYM}` namespace
 * is not keyed to a specific coin, so it collides across same-ticker projects —
 * see `docs/adr/0068-tradingview-first-icon-sourcing.md`).
 */
export function resolveTvIconUrl(market: Market): string | null {
  const logoid = resolveTvLogoid(market)
  if (!logoid) return null
  return `${TV_CDN_BASE}/${logoid}.svg`
}

/**
 * The Hyperliquid crypto-CDN fallback URL for a market, or null when there is
 * none (HIP-3 equities have no HL icon, and an empty normalized stem is unusable).
 * - Spot: `{BASE}_{QUOTE}.svg`
 * - Perp: `{COIN}.svg`
 */
export function resolveHlFallbackUrl(market: Market): string | null {
  const isHip3 = market.marketType === 'hip3'
  if (isHip3) return null

  const isSpot = market.marketType === 'spot'
  if (isSpot) {
    const base = normalizeCoinStem(market.baseAsset)
    if (base.length === 0) return null
    return `${HL_CDN_BASE}/${base}_${market.quoteAsset}.svg`
  }

  const coin = normalizeCoinStem(market.hlCoin ?? market.baseAsset)
  if (coin.length === 0) return null
  return `${HL_CDN_BASE}/${coin}.svg`
}

/**
 * Resolves the **primary** icon URL for a Market — class-aware.
 *
 * - **crypto (perp/spot)** → Hyperliquid CDN first (coin-correct), TradingView
 *   logoid second. TV's `crypto/XTVC{SYM}` namespace is not keyed to the coin HL
 *   lists, so it returns the wrong project for collision tickers (HYPE, ARB,
 *   PURR, …); HL's CDN is keyed by HL's own coin id and is always right.
 * - **HIP-3 (equities/commodities/indices/FX)** → TradingView only. HL has no
 *   icon for these classes.
 * - else → letter placeholder.
 *
 * The full ordered ladder (incl. the spot bare fallback) lives in
 * `use-asset-icon.ts#buildIconCandidates`. See
 * `docs/adr/0068-tradingview-first-icon-sourcing.md` (amended).
 */
export function resolveMarketIconUrl(market: Market): IconResolution {
  const tvUrl = resolveTvIconUrl(market)
  const hlUrl = resolveHlFallbackUrl(market)

  if (isCryptoMarket(market)) {
    if (hlUrl) return { kind: 'hl', url: hlUrl }
    if (tvUrl) return { kind: 'tv', url: tvUrl }
    return { kind: 'placeholder' }
  }

  if (tvUrl) return { kind: 'tv', url: tvUrl }
  if (hlUrl) return { kind: 'hl', url: hlUrl }
  return { kind: 'placeholder' }
}

/**
 * For spot markets only — the bare `{BASE}.svg` URL used as a fallback when
 * `{BASE}_{QUOTE}.svg` 404s (e.g. ZEC spot reuses the perp icon).
 * Returns null for non-spot markets or when the spot base normalizes to empty.
 */
export function resolveSpotBareIconUrl(market: Market): string | null {
  const isSpot = market.marketType === 'spot'
  if (!isSpot) return null
  const base = normalizeCoinStem(market.baseAsset)
  if (base.length === 0) return null
  return `${HL_CDN_BASE}/${base}.svg`
}
