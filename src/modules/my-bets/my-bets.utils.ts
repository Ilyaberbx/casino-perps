import type {
  Fill,
  Market,
  PerpPositionSnapshot,
  PlaceOrderRequest,
} from '@/modules/shared/domain'
import { formatPrice, specFromMarket } from '@/modules/shared/utils/format-price'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { CLOSE_CLOID_PREFIX, CLOSED_TRADES_LIMIT } from './my-bets.constants'
import type { ClosedTradeRow, OpenPositionRow, PositionSide } from './my-bets.types'

/** `long` → `LONG`, `short` → `SHORT` — the row label. */
export function sideLabel(side: PositionSide): 'LONG' | 'SHORT' {
  return side === 'long' ? 'LONG' : 'SHORT'
}

/**
 * The bare, uppercased base coin of a venue symbol, for display when the market
 * metadata has not resolved (`BTC-PERP` → `BTC`, `xyz:AAPL` → `AAPL`,
 * `HYPE/USDC` → `HYPE`). Mirrors the lobby's `displayTicker` rule; duplicated
 * here rather than reaching across the module boundary into `lobby/` internals.
 */
export function tickerFromSymbol(symbol: string): string {
  const afterDexPrefix = symbol.includes(':') ? symbol.slice(symbol.indexOf(':') + 1) : symbol
  const beforeQuote = afterDexPrefix.split('/')[0]
  const withoutTypeSuffix = beforeQuote.replace(/-(PERP|SPOT)$/i, '')
  return withoutTypeSuffix.toUpperCase()
}

/**
 * The formatted liquidation price for a position, or `null` when it is unknown
 * / non-positive. Uses the market's own precision when available; falls back to
 * a default spec (2dp) when the market metadata has not resolved yet.
 */
export function liquidationPriceText(
  liquidationPrice: number | null,
  market: Market | undefined,
): string | null {
  const hasLiquidation =
    liquidationPrice !== null && Number.isFinite(liquidationPrice) && liquidationPrice > 0
  if (!hasLiquidation) return null
  const spec = market ? specFromMarket(market) : { szDecimals: 0, marketType: 'perp' as const }
  return formatPrice(liquidationPrice, spec)
}

/** Project an open perps position into a positions-list row view. */
export function projectOpenPosition(
  position: PerpPositionSnapshot,
  market: Market | undefined,
  isClosing: boolean,
): OpenPositionRow {
  const ticker = market?.baseAsset ?? tickerFromSymbol(position.symbol)
  return {
    symbol: position.symbol,
    ticker,
    side: position.side,
    leverage: position.leverage,
    pnlUsd: position.unrealizedPnlUsd,
    isUp: position.unrealizedPnlUsd >= 0,
    liquidationPriceText: liquidationPriceText(position.liquidationPrice, market),
    isClosing,
  }
}

/**
 * Reduce-only market close of the full position — the opposite side, full size.
 * Mirrors the trade screen's close path so both flatten a position identically.
 */
export function buildFullCloseRequest(position: PerpPositionSnapshot): PlaceOrderRequest {
  return {
    orderType: 'market',
    symbol: position.symbol,
    side: position.side === 'long' ? 'sell' : 'buy',
    size: position.size,
    reduceOnly: true,
    clientOrderId: generateCloid(CLOSE_CLOID_PREFIX),
  }
}

/**
 * Whether a fill closed a trade: a close that booked realised PnL. Opening fills
 * (and any fill with no `closedPnl`) are not closes.
 */
export function isCloseFill(fill: Fill): boolean {
  const hasClosedPnl = fill.closedPnl !== undefined
  const isClose = fill.direction !== undefined && fill.direction.includes('Close')
  return hasClosedPnl && isClose
}

/**
 * The side of the position a close fill flattened: closing a `Long` was a long,
 * closing a `Short` was a short. Falls back to the fill side when the venue
 * direction label is absent (a `sell` closes a long).
 */
function closedPositionSide(fill: Fill): PositionSide {
  const isCloseLong = fill.direction?.includes('Long') === true
  const isCloseShort = fill.direction?.includes('Short') === true
  if (isCloseLong) return 'long'
  if (isCloseShort) return 'short'
  return fill.side === 'sell' ? 'long' : 'short'
}

/** Project a close `Fill` into a trade-history row view. */
export function projectClosedTrade(fill: Fill): ClosedTradeRow {
  const pnlUsd = fill.closedPnl ?? 0
  return {
    id: fill.identifier,
    ticker: tickerFromSymbol(fill.symbol),
    side: closedPositionSide(fill),
    pnlUsd,
    isUp: pnlUsd >= 0,
    timestamp: fill.timestamp,
  }
}

/**
 * Merge a newly-arrived fill into the accumulated trade history: keep only
 * closes, dedup by fill id, sort newest-first, and cap at
 * `CLOSED_TRADES_LIMIT`. Pure — the hook holds the list in state and feeds it
 * back through here on every fill.
 */
export function mergeClosedTrade(
  existing: ReadonlyArray<ClosedTradeRow>,
  fill: Fill,
): ReadonlyArray<ClosedTradeRow> {
  if (!isCloseFill(fill)) return existing
  const projected = projectClosedTrade(fill)
  const withoutDuplicate = existing.filter((trade) => trade.id !== projected.id)
  const merged = [projected, ...withoutDuplicate]
  merged.sort((a, b) => b.timestamp - a.timestamp)
  return merged.slice(0, CLOSED_TRADES_LIMIT)
}
