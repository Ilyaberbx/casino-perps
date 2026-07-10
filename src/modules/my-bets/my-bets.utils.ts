import type {
  Fill,
  Market,
  PerpPositionSnapshot,
  PlaceOrderRequest,
} from '@/modules/shared/domain'
import { formatPrice, specFromMarket } from '@/modules/shared/utils/format-price'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { CASH_OUT_CLOID_PREFIX, SETTLED_BETS_LIMIT } from './my-bets.constants'
import type { BetDirection, LiveBet, SettledBet } from './my-bets.types'

/** A long position is an UP bet; a short is a DOWN bet. */
export function positionSideToDirection(side: 'long' | 'short'): BetDirection {
  return side === 'long' ? 'up' : 'down'
}

/** `up` → `UP`, `down` → `DOWN` — the row label. */
export function directionLabel(direction: BetDirection): 'UP' | 'DOWN' {
  return direction === 'up' ? 'UP' : 'DOWN'
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
 * D16 — the liquidation price as a plain sentence, never a labelled number. An
 * UP (long) bet loses when the price *drops below* the liquidation; a DOWN
 * (short) bet loses when it *rises above*. `priceText` is the already-formatted
 * price (the hook formats it with the market's own precision) — `null` when the
 * liquidation is unknown, which degrades to a still-honest fallback sentence.
 */
export function formatLiquidationSentence(
  direction: BetDirection,
  ticker: string,
  priceText: string | null,
): string {
  if (priceText === null) return `You lose this bet if ${ticker} moves too far against you`
  const verb = direction === 'up' ? 'drops below' : 'rises above'
  return `You lose this bet if ${ticker} ${verb} $${priceText}`
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

/** Project an open perps position into a LIVE BETS row view. */
export function projectLiveBet(
  position: PerpPositionSnapshot,
  market: Market | undefined,
  isCashingOut: boolean,
): LiveBet {
  const direction = positionSideToDirection(position.side)
  const ticker = market?.baseAsset ?? tickerFromSymbol(position.symbol)
  const priceText = liquidationPriceText(position.liquidationPrice, market)
  return {
    symbol: position.symbol,
    ticker,
    direction,
    leverage: position.leverage,
    profitUsd: position.unrealizedPnlUsd,
    isWinning: position.unrealizedPnlUsd >= 0,
    liquidationSentence: formatLiquidationSentence(direction, ticker, priceText),
    isCashingOut,
  }
}

/**
 * Reduce-only market close of the full position — the opposite side, full size
 * (D17: market only). Mirrors the trade screen's Cash Out path so both close a
 * bet identically.
 */
export function buildFullCloseRequest(position: PerpPositionSnapshot): PlaceOrderRequest {
  return {
    orderType: 'market',
    symbol: position.symbol,
    side: position.side === 'long' ? 'sell' : 'buy',
    size: position.size,
    reduceOnly: true,
    clientOrderId: generateCloid(CASH_OUT_CLOID_PREFIX),
  }
}

/**
 * Whether a fill settles a bet: a close that booked realised profit/loss. Open
 * fills (and any fill with no `closedPnl`) are not settlements.
 */
export function isSettlementFill(fill: Fill): boolean {
  const hasClosedPnl = fill.closedPnl !== undefined
  const isClose = fill.direction !== undefined && fill.direction.includes('Close')
  return hasClosedPnl && isClose
}

/**
 * The original bet direction of a close fill: closing a `Long` was an UP bet,
 * closing a `Short` was a DOWN bet. Falls back to the fill side when the venue
 * direction label is absent (a `sell` closes a long ⇒ UP).
 */
function settledBetDirection(fill: Fill): BetDirection {
  const isCloseLong = fill.direction?.includes('Long') === true
  const isCloseShort = fill.direction?.includes('Short') === true
  if (isCloseLong) return 'up'
  if (isCloseShort) return 'down'
  return fill.side === 'sell' ? 'up' : 'down'
}

/** Project a settlement `Fill` into a SETTLED history row view. */
export function projectSettledBet(fill: Fill): SettledBet {
  const profitUsd = fill.closedPnl ?? 0
  return {
    id: fill.identifier,
    ticker: tickerFromSymbol(fill.symbol),
    direction: settledBetDirection(fill),
    profitUsd,
    isWin: profitUsd >= 0,
    timestamp: fill.timestamp,
  }
}

/**
 * Merge a newly-arrived fill into the accumulated settled-bet list: keep only
 * settlements, dedup by fill id, sort newest-first, and cap at
 * `SETTLED_BETS_LIMIT`. Pure — the hook holds the list in state and feeds it
 * back through here on every fill.
 */
export function mergeSettledBet(
  existing: ReadonlyArray<SettledBet>,
  fill: Fill,
): ReadonlyArray<SettledBet> {
  if (!isSettlementFill(fill)) return existing
  const projected = projectSettledBet(fill)
  const withoutDuplicate = existing.filter((bet) => bet.id !== projected.id)
  const merged = [projected, ...withoutDuplicate]
  merged.sort((a, b) => b.timestamp - a.timestamp)
  return merged.slice(0, SETTLED_BETS_LIMIT)
}
