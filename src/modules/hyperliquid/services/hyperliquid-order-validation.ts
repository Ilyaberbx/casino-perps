import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { z } from 'zod'
import type {
  OrderCapacity,
  OrderDraft,
  OrderEstimates,
  OrderIssue,
  PlaceOrderRequest,
} from '@/modules/shared/domain'
import {
  DEFAULT_SLIPPAGE_PERCENT,
  MAX_SLIPPAGE_PERCENT,
  MIN_ORDER_VALUE_USD,
  TWAP_FREQUENCY_SECONDS,
  TWAP_MAX_DURATION_MINUTES,
  TWAP_MIN_DURATION_MINUTES,
} from './hyperliquid-trader.constants'
import type {
  HyperliquidAssetInfo,
  HyperliquidOrderValidation,
  HyperliquidOrderValidationDeps,
  HyperliquidValidationPosition,
} from './hyperliquid-trader.types'

const PERCENT_DIVISOR = 100
const COIN_DECIMALS = 6
const USD_DECIMALS = 2

/** Hyperliquid caps every non-integer price at 5 significant figures
 *  (`tickRejected`). Integer prices are exempt — any integer is a valid tick. */
const MAX_PRICE_SIGNIFICANT_FIGURES = 5
/** Max decimal places a price may carry: `(N − szDecimals)`, N differing by
 *  market type — perp/HIP-3 use 6, spot uses 8 (mirrors HL `formatPrice`). */
const MAX_PERP_PRICE_DECIMALS = 6
const MAX_SPOT_PRICE_DECIMALS = 8

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** A trimmed-string Zod schema that parses to a positive finite number. Empty
 *  or non-positive / non-numeric input fails — the single source of the
 *  "value > 0" rule shared by size and the price fields. */
const positiveNumberSchema = z
  .string()
  .transform((raw) => Number(raw.trim()))
  .refine((value) => Number.isFinite(value) && value > 0)

/** A non-negative integer field (twap hours / minutes); empty / invalid → 0. */
function parseNonNegativeInt(input: string): number {
  const trimmed = input.trim()
  if (trimmed.length === 0) return 0
  const parsed = Number(trimmed)
  const isUsable = Number.isFinite(parsed) && parsed >= 0
  if (!isUsable) return 0
  return Math.floor(parsed)
}

function twapDurationMinutes(draft: OrderDraft): number {
  return parseNonNegativeInt(draft.twapHoursInput) * 60 + parseNonNegativeInt(draft.twapMinutesInput)
}

/** Parse a price field to a positive number, or `null` when empty / invalid. */
function parsePrice(input: string): number | null {
  const result = positiveNumberSchema.safeParse(input)
  return result.success ? result.data : null
}

/**
 * Resolve the coin size the draft represents. `coin` size is verbatim; `usd`
 * size is margin (collateral) that buys a leveraged position
 * (`coin = margin × leverage / markPrice`). Spot markets always price at 1×
 * (no leverage), so the margin is the notional. Returns 0 when unparseable or
 * the mark / leverage is unusable.
 */
function resolveCoinSize(draft: OrderDraft, markPrice: number, isSpot: boolean): number {
  const rawSize = parsePrice(draft.sizeInput)
  if (rawSize === null) return 0
  if (draft.sizeUnit === 'coin') return roundTo(rawSize, COIN_DECIMALS)
  const leverage = isSpot ? 1 : draft.leverage
  const isPriceUsable = markPrice > 0
  const isLeverageUsable = leverage > 0
  if (!isPriceUsable || !isLeverageUsable) return 0
  return roundTo((rawSize * leverage) / markPrice, COIN_DECIMALS)
}

/** Slippage tolerance as a fraction (e.g. 0.05), applying the venue default
 *  when empty and clamping an over-cap value to MAX. */
function resolveSlippageFraction(draft: OrderDraft): number {
  const parsed = parsePrice(draft.slippageInput)
  const percent = parsed === null ? DEFAULT_SLIPPAGE_PERCENT : Math.min(parsed, MAX_SLIPPAGE_PERCENT)
  return percent / PERCENT_DIVISOR
}

function sizeIssues(coinSize: number): OrderIssue[] {
  const isSizeMissing = coinSize <= 0
  if (!isSizeMissing) return []
  return [{ field: 'size', message: 'Enter an order size greater than 0.' }]
}

/** Min-notional issue (`minTradeNtlRejected`). Exempt for reduce-only (closing)
 *  orders and when the mark price is unknown (can't be checked). */
function notionalIssues(coinSize: number, markPrice: number, reduceOnly: boolean): OrderIssue[] {
  const isUncheckable = markPrice <= 0 || coinSize <= 0
  const isExempt = reduceOnly || isUncheckable
  if (isExempt) return []
  const notional = coinSize * markPrice
  const isBelowMin = notional < MIN_ORDER_VALUE_USD
  if (!isBelowMin) return []
  return [{ field: 'size', message: `Minimum order value is $${MIN_ORDER_VALUE_USD}.` }]
}

/** Slippage-band issue. An empty field is valid (falls back to the default); a
 *  non-empty value is valid only when `0 < p ≤ MAX`. */
function slippageIssues(draft: OrderDraft): OrderIssue[] {
  const trimmed = draft.slippageInput.trim()
  const isEmpty = trimmed.length === 0
  if (isEmpty) return []
  const parsed = Number(trimmed)
  const isPositive = Number.isFinite(parsed) && parsed > 0
  if (isPositive) return []
  return [{ field: 'slippage', message: 'Slippage must be a positive percent.' }]
}

function limitPriceIssues(draft: OrderDraft): OrderIssue[] {
  const hasPrice = parsePrice(draft.priceInput) !== null
  if (hasPrice) return []
  return [{ field: 'price', message: 'Enter a limit price greater than 0.' }]
}

function stopPriceIssues(draft: OrderDraft): OrderIssue[] {
  const hasStop = parsePrice(draft.stopPriceInput) !== null
  if (hasStop) return []
  return [{ field: 'stopPrice', message: 'Enter a stop price greater than 0.' }]
}

function twapDurationIssues(draft: OrderDraft): OrderIssue[] {
  const minutes = twapDurationMinutes(draft)
  const isAtOrAboveMin = minutes >= TWAP_MIN_DURATION_MINUTES
  const isAtOrBelowMax = minutes <= TWAP_MAX_DURATION_MINUTES
  const isWithinClamp = isAtOrAboveMin && isAtOrBelowMax
  if (isWithinClamp) return []
  return [
    {
      field: 'twapDuration',
      message: `TWAP running time must be between ${TWAP_MIN_DURATION_MINUTES}m and ${TWAP_MAX_DURATION_MINUTES}m.`,
    },
  ]
}

/**
 * Decimal places in a number's minimal representation — `1.20 → 1`, `5 → 0`,
 * `0.001 → 3`. Counts the canonical value, so trailing zeros the user typed
 * (`1.2300`) do not inflate the count beyond the real precision. Exponential
 * notation (very small / large numbers) is treated as 0 decimals; such values
 * never reach here because the price fields parse human decimal strings.
 */
function decimalPlacesOf(value: number): number {
  const text = String(value)
  const dotIndex = text.indexOf('.')
  if (dotIndex === -1) return 0
  return text.length - dotIndex - 1
}

/**
 * Significant figures in a number — `1.2345 → 5`, `120 → 2` (trailing integer
 * zeros are not significant), `0.00012 → 2` (leading zeros are not). Mirrors
 * HL's 5-sig-fig price rule.
 */
function significantFiguresOf(value: number): number {
  const isZero = value === 0
  if (isZero) return 0
  const digitsOnly = String(Math.abs(value)).replace('.', '')
  const withoutLeadingZeros = digitsOnly.replace(/^0+/, '')
  const withoutTrailingZeros = withoutLeadingZeros.replace(/0+$/, '')
  return withoutTrailingZeros.length
}

/** Max decimal places allowed for a price on this market — `(N − szDecimals)`,
 *  N = 8 spot / 6 perp & HIP-3 (HIP-3 resolves to `'perp'` asset info). */
function maxPriceDecimalsFor(asset: HyperliquidAssetInfo): number {
  const base = asset.marketType === 'spot' ? MAX_SPOT_PRICE_DECIMALS : MAX_PERP_PRICE_DECIMALS
  return base - asset.szDecimals
}

/**
 * Whether a price satisfies HL's tick rule (`tickRejected`, S3). Integer prices
 * are always valid; a fractional price must fit BOTH the 5-significant-figure
 * cap AND the per-market decimal cap. We reject (never silently truncate) so the
 * submitted price is never quietly different from what the user typed.
 */
function isPriceWithinTick(price: number, asset: HyperliquidAssetInfo): boolean {
  const isInteger = Number.isInteger(price)
  if (isInteger) return true
  const fitsSignificantFigures = significantFiguresOf(price) <= MAX_PRICE_SIGNIFICANT_FIGURES
  const fitsDecimals = decimalPlacesOf(price) <= maxPriceDecimalsFor(asset)
  return fitsSignificantFigures && fitsDecimals
}

/** Price-tick issue (S3) for the limit price of a limit / stop-limit order.
 *  Skipped when the price is absent (the "> 0" rule already flags it) or the
 *  asset is unknown to the venue (no szDecimals to check against). */
function priceTickIssues(draft: OrderDraft, asset: HyperliquidAssetInfo | null): OrderIssue[] {
  const price = parsePrice(draft.priceInput)
  const isUncheckable = price === null || asset === null
  if (isUncheckable) return []
  const isWithinTick = isPriceWithinTick(price, asset)
  if (isWithinTick) return []
  return [{ field: 'price', message: 'Price has too many digits for this market.' }]
}

/** Price-tick issue (S3) for the trigger (stop) price of a stop-limit order.
 *  Same rule as the limit price, tagged to `stopPrice`. */
function stopPriceTickIssues(draft: OrderDraft, asset: HyperliquidAssetInfo | null): OrderIssue[] {
  const stopPrice = parsePrice(draft.stopPriceInput)
  const isUncheckable = stopPrice === null || asset === null
  if (isUncheckable) return []
  const isWithinTick = isPriceWithinTick(stopPrice, asset)
  if (isWithinTick) return []
  return [{ field: 'stopPrice', message: 'Trigger price has too many digits for this market.' }]
}

/** Size lot-step issue (`szDecimals`, S4): a size carrying more decimal places
 *  than the asset's lot size is rejected (HL `formatSize` truncates otherwise).
 *  Skipped when the size is absent (the "> 0" rule flags it) or the asset is
 *  unknown. Reads the raw coin-unit input only — usd-unit sizes are a derived
 *  figure the venue rounds itself. */
function sizeLotStepIssues(draft: OrderDraft, asset: HyperliquidAssetInfo | null): OrderIssue[] {
  const isCoinUnit = draft.sizeUnit === 'coin'
  const size = parsePrice(draft.sizeInput)
  const isUncheckable = !isCoinUnit || size === null || asset === null
  if (isUncheckable) return []
  const fitsLotStep = decimalPlacesOf(size) <= asset.szDecimals
  if (fitsLotStep) return []
  return [{ field: 'size', message: 'Size has too many decimal places for this market.' }]
}

/**
 * Trigger side-of-mark issue (`badTriggerPxRejected`, S5). A stop-loss must sit
 * below the mark for a long / above for a short; a take-profit is the inverse.
 * "Stop-market" trades are stop-losses; the take-profit leg rides the same
 * `stopPrice` field, so both directions are validated relative to the mark and
 * the order side. Skipped when the trigger or the mark is unknown (uncheckable).
 *
 * A long entry's loss-protection trigger fires when price falls (below mark);
 * a long's profit trigger fires when price rises (above mark) — and inversely
 * for a short. We do not know whether the user intends SL vs TP, so a trigger
 * is "sensible" if it lands on EITHER side that some trigger could occupy —
 * i.e. the only nonsensical trigger is one exactly at the mark, OR one whose
 * implied direction contradicts the order side. Per the spec we treat a
 * stop/TP as: long-side triggers below mark (stop-loss for a long position
 * the order would open/extend); short-side triggers above mark.
 */
function triggerSideIssues(stopPrice: number | null, markPrice: number, side: OrderDraft['side']): OrderIssue[] {
  const isUncheckable = stopPrice === null || markPrice <= 0
  if (isUncheckable) return []
  const isBelowMark = stopPrice < markPrice
  const isAboveMark = stopPrice > markPrice
  const isLong = side === 'buy'
  // A long's stop-loss trigger sits below mark; a short's sits above. A trigger
  // on the wrong side (or exactly at the mark) cannot fire as intended.
  const isOnSensibleSide = isLong ? isBelowMark : isAboveMark
  if (isOnSensibleSide) return []
  return [{ field: 'stopPrice', message: 'Trigger price is on the wrong side of the mark for this order.' }]
}

/**
 * Reduce-only-reduces issue (`reduceOnlyRejected`, S6). A reduce-only order must
 * close (not open / extend) a position: it must be the OPPOSITE side of the open
 * position and no larger than it. No open position ⇒ nothing to reduce ⇒ reject.
 * Only applies when `reduceOnly` is set; otherwise the order opens freely.
 */
function reduceOnlyIssues(
  reduceOnly: boolean,
  coinSize: number,
  side: OrderDraft['side'],
  position: HyperliquidValidationPosition | null,
): OrderIssue[] {
  if (!reduceOnly) return []
  const hasNoPosition = position === null
  if (hasNoPosition) return [{ field: 'size', message: 'No open position to reduce.' }]
  const isOppositeSide = position.side !== side
  const fitsPositionSize = coinSize <= position.size
  const reduces = isOppositeSide && fitsPositionSize
  if (reduces) return []
  return [{ field: 'size', message: 'A reduce-only order must reduce your open position.' }]
}

/**
 * The Hyperliquid venue's order validation + preview (ADR-0035 D-1). The same
 * draft parser feeds `validateDraft` (the pre-check) and the `PlaceOrderRequest`
 * `placeOrder` consumes — the client pre-check can never drift from acceptance
 * (D-2). Implements the pre-ADR rules (size > 0, limit/stop price required & > 0,
 * min-notional ≥ $10, TWAP [5m, 1440m], slippage band) plus the ADR-0035 D-8
 * tier-1 deterministic rules: price tick (S3), size lot-step (S4), trigger
 * side-of-mark (S5), and reduce-only-reduces (S6). Stateless: every input is
 * read through `deps` at call time.
 */
export function createHyperliquidOrderValidation(
  deps: HyperliquidOrderValidationDeps,
): HyperliquidOrderValidation {
  /** Build the typed `PlaceOrderRequest` from a draft already known to be valid.
   *  TP/SL legs are attached by `trading/` (they are not draft fields). */
  function buildRequest(
    draft: OrderDraft,
    symbol: string,
    coinSize: number,
  ): Result<PlaceOrderRequest, OrderIssue[]> {
    const base = {
      symbol,
      side: draft.side,
      size: coinSize,
      reduceOnly: draft.reduceOnly,
    }
    if (draft.orderType === 'market') {
      return ok({ ...base, orderType: 'market', slippageTolerance: resolveSlippageFraction(draft) })
    }
    if (draft.orderType === 'limit') {
      return ok({ ...base, orderType: 'limit', price: parsePrice(draft.priceInput) ?? 0, timeInForce: draft.timeInForce })
    }
    if (draft.orderType === 'stop-market') {
      return ok({
        ...base,
        orderType: 'stop-market',
        stopPrice: parsePrice(draft.stopPriceInput) ?? 0,
        slippageTolerance: resolveSlippageFraction(draft),
      })
    }
    if (draft.orderType === 'stop-limit') {
      return ok({
        ...base,
        orderType: 'stop-limit',
        stopPrice: parsePrice(draft.stopPriceInput) ?? 0,
        price: parsePrice(draft.priceInput) ?? 0,
        timeInForce: draft.timeInForce,
      })
    }
    return ok({
      ...base,
      orderType: 'twap',
      durationMinutes: twapDurationMinutes(draft),
      randomize: draft.randomize,
    })
  }

  function collectIssues(
    draft: OrderDraft,
    coinSize: number,
    markPrice: number,
    asset: HyperliquidAssetInfo | null,
    position: HyperliquidValidationPosition | null,
  ): OrderIssue[] {
    const isLimit = draft.orderType === 'limit'
    const isStopMarket = draft.orderType === 'stop-market'
    const isStopLimit = draft.orderType === 'stop-limit'
    const isTwap = draft.orderType === 'twap'
    const isMarket = draft.orderType === 'market'
    const usesLimitPrice = isLimit || isStopLimit
    const usesStopPrice = isStopMarket || isStopLimit
    const usesSlippage = isMarket || isStopMarket
    const issues = [...sizeIssues(coinSize)]
    issues.push(...sizeLotStepIssues(draft, asset))
    if (usesLimitPrice) issues.push(...limitPriceIssues(draft), ...priceTickIssues(draft, asset))
    if (usesStopPrice) {
      issues.push(...stopPriceIssues(draft))
      issues.push(...triggerSideIssues(parsePrice(draft.stopPriceInput), markPrice, draft.side))
    }
    if (isStopLimit) issues.push(...stopPriceTickIssues(draft, asset))
    if (usesSlippage) issues.push(...slippageIssues(draft))
    if (isTwap) issues.push(...twapDurationIssues(draft))
    issues.push(...notionalIssues(coinSize, markPrice, draft.reduceOnly))
    issues.push(...reduceOnlyIssues(draft.reduceOnly, coinSize, draft.side, position))
    return issues
  }

  function validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]> {
    const symbol = draft.symbol
    if (symbol === '') return err([{ message: 'No market selected.' }])
    const markPrice = deps.markPriceFor(symbol)
    const isSpot = deps.isSpotMarket(symbol)
    const asset = deps.resolveAsset(symbol)
    const position = deps.currentPositionFor(symbol)
    const coinSize = resolveCoinSize(draft, markPrice, isSpot)
    const issues = collectIssues(draft, coinSize, markPrice, asset, position)
    if (issues.length > 0) return err(issues)
    return buildRequest(draft, symbol, coinSize)
  }

  /** Capacity (max coin size at 100%). Perp/HIP-3: buying power = available
   *  margin × leverage ÷ mark. Spot: side-relevant balance — buy → USDC ÷ mark,
   *  sell → base holdings. */
  function resolveCapacity(draft: OrderDraft, symbol: string, markPrice: number, isSpot: boolean): OrderCapacity {
    if (isSpot) {
      const available = deps.spotAvailableFor(symbol, draft.side)
      const isBuy = draft.side === 'buy'
      const maxCoinSize = isBuy ? (markPrice > 0 ? roundTo(available / markPrice, COIN_DECIMALS) : 0) : available
      return { maxCoinSize }
    }
    const availableMargin = deps.availableMarginFor(symbol)
    const hasPower = availableMargin > 0 && draft.leverage > 0 && markPrice > 0
    const maxCoinSize = hasPower ? roundTo((availableMargin * draft.leverage) / markPrice, COIN_DECIMALS) : 0
    return { maxCoinSize }
  }

  function previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity } {
    const symbol = draft.symbol
    const markPrice = deps.markPriceFor(symbol)
    const isSpot = deps.isSpotMarket(symbol)
    const coinSize = resolveCoinSize(draft, markPrice, isSpot)
    const notional = coinSize > 0 && markPrice > 0 ? roundTo(coinSize * markPrice, USD_DECIMALS) : 0
    const fee = roundTo(notional * deps.takerRate(), USD_DECIMALS)
    const capacity = resolveCapacity(draft, symbol, markPrice, isSpot)

    if (draft.orderType === 'twap') {
      const runtimeMinutes = twapDurationMinutes(draft)
      const numberOfOrders = runtimeMinutes > 0 ? Math.floor((runtimeMinutes * 60) / TWAP_FREQUENCY_SECONDS) + 1 : 0
      const sizePerSuborder = numberOfOrders > 0 ? roundTo(coinSize / numberOfOrders, COIN_DECIMALS) : 0
      const estimates: OrderEstimates = {
        kind: 'twap',
        notional,
        frequencySeconds: TWAP_FREQUENCY_SECONDS,
        runtimeMinutes,
        numberOfOrders,
        sizePerSuborder,
        fee,
        hasBuilderFee: deps.hasBuilderFee,
      }
      return { estimates, capacity }
    }

    const leverage = isSpot ? 1 : draft.leverage
    const margin = leverage > 0 ? roundTo(notional / leverage, USD_DECIMALS) : 0
    // Liquidation only on perp/HIP-3 market orders (1× spot has none; non-market
    // types omit the row). Long liquidates below mark, short above.
    const showsLiquidation = draft.orderType === 'market' && !isSpot && markPrice > 0 && leverage > 0
    const inverseLeverage = leverage > 0 ? 1 / leverage : 0
    const isLong = draft.side === 'buy'
    const rawLiquidation = isLong ? markPrice * (1 - inverseLeverage) : markPrice * (1 + inverseLeverage)
    const liquidationPrice = showsLiquidation && rawLiquidation > 0 ? roundTo(rawLiquidation, USD_DECIMALS) : 0
    const estimates: OrderEstimates = {
      kind: 'linear',
      notional,
      margin,
      liquidationPrice,
      fee,
      hasBuilderFee: deps.hasBuilderFee,
    }
    return { estimates, capacity }
  }

  return { validateDraft, previewOrder }
}
