import type {
  Order,
  PerpPositionSnapshot,
  PortfolioHistoryFetchError,
  Side,
} from '@/modules/shared/domain'
import type { PositionTpsl } from './account-dock.types'
import { formatTokenAmount } from '@/modules/shared/utils/format-number'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { formatMarketDisplaySymbol } from '@/modules/shared/utils/format-market-display-symbol'

const USDC_TOKEN = 'USDC'
// Fee values are tiny (e.g. 0.010613 USDC); the dock-wide 3dp cap would collapse
// them to 0.011, hiding the precision a trader checks. Render money cells with
// enough decimals to keep small fees legible while still trimming trailing zeros.
const MONEY_MAX_DECIMALS = 6

// Maps a typed history-fetch error to a user-facing string. `subject` names the
// tab ("trade history", "funding history") so the network message reads
// naturally; shared by every paginated dock tab via `useAccountDock`.
export function historyErrorMessage(
  error: PortfolioHistoryFetchError,
  subject: string,
): string {
  if (error.kind === 'rate-limited') return 'Rate limited by the venue. Retry shortly.'
  if (error.kind === 'unknown') return error.message
  return `Network error fetching ${subject}.`
}

// Appends a live row count to a dock tab label ("POSITIONS" → "POSITIONS (30)"),
// matching trade.xyz. Only the bounded current-state tabs (Positions, Open
// Orders, TWAP, Balances) pass a count; unbounded history tabs pass `undefined`
// and render the bare label.
export function dockTabLabel(label: string, count: number | undefined): string {
  if (count === undefined) return label
  return `${label} (${count})`
}

export function panelClassName(
  panelClass: string,
  hiddenClass: string,
  isVisible: boolean,
): string {
  return isVisible ? panelClass : `${panelClass} ${hiddenClass}`
}

// Perps direction label for an order/position side (buy ⇒ Long, sell ⇒ Short),
// matching trade.xyz's Direction column.
export function directionLabel(side: Side): 'Long' | 'Short' {
  return side === 'buy' ? 'Long' : 'Short'
}

export function pnlSign(value: number): 'positive' | 'negative' | 'zero' {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'zero'
}

// Margin-mode suffix for the Positions Margin cell ("$4.83 (Cross)"), matching
// trade.xyz. Derived from the position's `leverageType` — cross margin shares
// the account's collateral pool, isolated margin pins collateral to the position.
export function marginModeLabel(leverageType: 'cross' | 'isolated'): string {
  return leverageType === 'cross' ? 'Cross' : 'Isolated'
}

// Keyboard activation keys for a non-native interactive element (e.g. a row
// given `role="button"`): Enter and Space, mirroring native button semantics.
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}

export function formatFillTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// History rows span up to 30 days, so a bare clock time is ambiguous — show a
// compact local date + time (used by Trade History and Order History).
export function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Account Activity rows show a full local date + 24h clock to the second
// ("6/6/2026 - 01:11:18") — ledger events are precise and the explorer link
// next to it should match the on-chain timestamp.
export function formatActivityTime(timestamp: number): string {
  const date = new Date(timestamp)
  const day = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const clock = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return `${day} - ${clock}`
}

// Labels the viewer's UTC offset for the Account Activity "Time" header
// ("GMT+3", "GMT-5", "GMT+5:30"). Input is `Date.prototype.getTimezoneOffset()`:
// minutes the local zone is *behind* UTC (negative for zones ahead of UTC), so
// the displayed sign is inverted.
export function formatGmtOffsetLabel(offsetMinutesBehindUtc: number): string {
  const MINUTES_PER_HOUR = 60
  const minutesAheadOfUtc = -offsetMinutesBehindUtc
  const sign = minutesAheadOfUtc < 0 ? '-' : '+'
  const absMinutes = Math.abs(minutesAheadOfUtc)
  const hours = Math.floor(absMinutes / MINUTES_PER_HOUR)
  const minutes = absMinutes % MINUTES_PER_HOUR
  const minutesSuffix = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`
  return `GMT${sign}${hours}${minutesSuffix}`
}

// Funding rate is a per-interval fraction; rendered as a percentage capped at
// 3 fraction digits to match the dock-wide decimal policy.
export function formatFundingRate(rate: number): string {
  return `${(rate * 100).toFixed(3)}%`
}

// TWAP duration is stored in minutes; show hours+minutes once it exceeds an
// hour so multi-hour orders read cleanly (e.g. "2h 30m", "45m").
export function formatTwapDuration(durationMinutes: number): string {
  const MINUTES_PER_HOUR = 60
  const hours = Math.floor(durationMinutes / MINUTES_PER_HOUR)
  const minutes = durationMinutes % MINUTES_PER_HOUR
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

// Taker/Maker label for the Trade History Type column from the venue's `crossed`
// flag. `true` ⇒ the fill crossed the spread (Taker), `false` ⇒ Maker — and
// `false` must NOT collapse to absent: a venue that omits the flag renders `--`.
export function fillCrossingLabel(crossed?: boolean): 'Taker' | 'Maker' | '--' {
  if (crossed === undefined) return '--'
  return crossed ? 'Taker' : 'Maker'
}

// Money cells in the dock (Value / Fee / Closed PNL) render the raw amount
// denominated in its quote/fee token verbatim — "0.010613 USDC", never "$0.01"
// (HL fees can be in a non-USDC token, which conversion would erase). `signed`
// forces a leading `+` on non-negative values for the Closed PNL column.
export function formatTokenWithUnit(
  value: number,
  unit: string,
  options: { signed?: boolean } = {},
): string {
  const isNegative = value < 0
  const wantsLeadingPlus = options.signed === true && !isNegative
  const sign = wantsLeadingPlus ? '+' : ''
  return `${sign}${formatTokenAmount(value, MONEY_MAX_DECIMALS)} ${unit}`
}

// Base asset to suffix a Trade History Size cell ("0.00022 BTC"). Perp fills
// carry the bare coin (`BTC`) or a HIP-3 namespaced coin (`xyz:NVDA` → `NVDA`);
// spot fills carry the raw venue key (`@107`, `PURR/USDC`). Only a clean asset
// name suffixes the size — a spot pair or `@N` key falls back to no suffix so
// the cell never reads "0.5 @107".
export function fillSizeAsset(symbol: string): string | null {
  const isSpotKey = symbol.includes('/') || symbol.startsWith('@')
  if (isSpotKey) return null
  return parseHip3Symbol(symbol).displaySymbol
}

// Trade History Size cell text: the amount, suffixed with the base asset when
// one can be derived cleanly (perp / HIP-3), bare otherwise (spot keys).
export function formatFillSize(size: number, symbol: string): string {
  const asset = fillSizeAsset(symbol)
  const amount = formatTokenAmount(size, MONEY_MAX_DECIMALS)
  if (asset === null) return amount
  return `${amount} ${asset}`
}

export const FILL_QUOTE_TOKEN = USDC_TOKEN

// Display label for a position/order symbol in the dock's dialogs and toasts.
// Strips the perp identity suffix ('BTC-PERP' → 'BTC', via the shared edge
// projection) and the HIP-3 dex prefix ('xyz:NVDA' → 'NVDA'); spot pairs pass
// through. Display-only — the raw symbol is what every request/toast key uses.
export function formatDockSymbol(symbol: string): string {
  const withoutPerpSuffix = formatMarketDisplaySymbol(symbol)
  return parseHip3Symbol(withoutPerpSuffix).displaySymbol
}


// ADR-0051 D-3: derive a position's resting TP/SL trigger prices from the
// open-orders snapshot. A leg matches the position when it is a reduce-only
// trigger order on the same symbol carrying a trigger price. Classification
// prefers the venue's `triggerKind`; absent it, falls back to the entry-relative
// side rule (a reduce-only trigger above entry closes a long in profit = TP,
// below = SL; inverted for a short). When multiple legs of the same kind rest
// on the position, the most recent (highest timestamp) wins.
export function derivePositionTpsl(
  orders: ReadonlyArray<Order>,
  position: PerpPositionSnapshot,
): PositionTpsl {
  let tp: Order | undefined
  let sl: Order | undefined
  for (const order of orders) {
    const isProtectionLeg = isPositionProtectionLeg(order, position.symbol)
    if (!isProtectionLeg) continue
    const kind = classifyProtectionLeg(order, position)
    if (kind === 'tp') tp = mostRecent(tp, order)
    if (kind === 'sl') sl = mostRecent(sl, order)
  }
  return { tpPrice: tp?.triggerPrice, slPrice: sl?.triggerPrice }
}

function isPositionProtectionLeg(order: Order, positionSymbol: string): boolean {
  const isSameSymbol = order.symbol === positionSymbol
  const isReduceOnly = order.reduceOnly === true
  const hasTriggerPrice = order.triggerPrice !== undefined && order.triggerPrice > 0
  return isSameSymbol && isReduceOnly && hasTriggerPrice
}

function classifyProtectionLeg(
  order: Order,
  position: PerpPositionSnapshot,
): 'tp' | 'sl' {
  if (order.triggerKind !== undefined) return order.triggerKind
  // Fallback: trigger price is guaranteed present by `isPositionProtectionLeg`.
  const triggerPrice = order.triggerPrice ?? 0
  const isAboveEntry = triggerPrice > position.entryPrice
  const isLong = position.side === 'long'
  const closesInProfit = isLong ? isAboveEntry : !isAboveEntry
  return closesInProfit ? 'tp' : 'sl'
}

function mostRecent(current: Order | undefined, candidate: Order): Order {
  if (current === undefined) return candidate
  return candidate.timestamp >= current.timestamp ? candidate : current
}

// Formats a position's TP/SL pair for the Positions table cell ("70,000 / --").
// Each side shows the trigger price (token-amount formatting, matching the
// neighbouring Entry/Mark/Liq cells) or `--` when no leg rests on that side.
export function formatTpslCell(tpsl: PositionTpsl): string {
  const tp = tpsl.tpPrice === undefined ? '--' : formatTokenAmount(tpsl.tpPrice)
  const sl = tpsl.slPrice === undefined ? '--' : formatTokenAmount(tpsl.slPrice)
  return `${tp} / ${sl}`
}
