import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import type {
  OrderCapacity,
  OrderDraft,
  OrderEstimates,
  OrderIssue,
  PlaceOrderRequest,
} from '../../shared/domain'
import type {
  MockOrderValidation,
  MockOrderValidationDeps,
} from '../mock-venue.types'
import {
  MOCK_DEFAULT_SLIPPAGE_PERCENT,
  MOCK_MAX_SLIPPAGE_PERCENT,
  MOCK_MAX_TWAP_DURATION_MINUTES,
  MOCK_MIN_ORDER_VALUE_USD,
  MOCK_MIN_TWAP_DURATION_MINUTES,
  MOCK_TAKER_RATE,
  MOCK_TWAP_FREQUENCY_SECONDS,
} from '../mock-venue.constants'

const PERCENT_DIVISOR = 100
const COIN_DECIMALS = 6
const USD_DECIMALS = 2

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Parse a positive finite number from a raw field; null when empty/invalid. */
function parsePositive(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  const isUsable = Number.isFinite(parsed) && parsed > 0
  if (!isUsable) return null
  return parsed
}

/** Parse a non-negative integer field (twap hours / minutes); 0 when empty/invalid. */
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

/**
 * Resolve the coin size the draft represents. `coin` size is taken verbatim;
 * `usd` size is margin (collateral) that buys a leveraged position
 * (`coin = margin × leverage / markPrice`). Returns 0 when unparseable or the
 * mark price is unusable.
 */
function resolveCoinSize(draft: OrderDraft, markPrice: number): number {
  const rawSize = parsePositive(draft.sizeInput)
  if (rawSize === null) return 0
  if (draft.sizeUnit === 'coin') return roundTo(rawSize, COIN_DECIMALS)
  const isPriceUsable = markPrice > 0
  const isLeverageUsable = draft.leverage > 0
  if (!isPriceUsable || !isLeverageUsable) return 0
  return roundTo((rawSize * draft.leverage) / markPrice, COIN_DECIMALS)
}

/** Slippage tolerance as a fraction (e.g. 0.08), applying the default when empty. */
function resolveSlippageFraction(draft: OrderDraft): number {
  const parsed = parsePositive(draft.slippageInput)
  const percent = parsed === null ? MOCK_DEFAULT_SLIPPAGE_PERCENT : Math.min(parsed, MOCK_MAX_SLIPPAGE_PERCENT)
  return percent / PERCENT_DIVISOR
}

/** Collect the size issue (shared by every order type). */
function sizeIssues(coinSize: number): OrderIssue[] {
  const isSizeMissing = coinSize <= 0
  if (isSizeMissing) return [{ field: 'size', message: 'Enter an order size greater than 0.' }]
  return []
}

/**
 * Min-notional issue. Exempt for reduce-only (closing) orders and when the mark
 * price is unknown (can't be checked). Mirrors HL's `size × price ≥ $10` rule.
 */
function notionalIssues(coinSize: number, markPrice: number, reduceOnly: boolean): OrderIssue[] {
  const isExempt = reduceOnly || markPrice <= 0 || coinSize <= 0
  if (isExempt) return []
  const notional = coinSize * markPrice
  const isBelowMin = notional < MOCK_MIN_ORDER_VALUE_USD
  if (isBelowMin) {
    return [{ field: 'size', message: `Order value must be at least $${MOCK_MIN_ORDER_VALUE_USD}.` }]
  }
  return []
}

/** Slippage-band issue (only meaningful for market / stop-market). */
function slippageIssues(draft: OrderDraft): OrderIssue[] {
  const trimmed = draft.slippageInput.trim()
  if (trimmed.length === 0) return []
  const parsed = Number(trimmed)
  const isWithinBand = Number.isFinite(parsed) && parsed > 0 && parsed <= MOCK_MAX_SLIPPAGE_PERCENT
  if (isWithinBand) return []
  return [
    {
      field: 'slippage',
      message: `Slippage must be between 0% and ${MOCK_MAX_SLIPPAGE_PERCENT}%.`,
    },
  ]
}

function limitPriceIssues(draft: OrderDraft): OrderIssue[] {
  const price = parsePositive(draft.priceInput)
  if (price !== null) return []
  return [{ field: 'price', message: 'Enter a limit price greater than 0.' }]
}

function stopPriceIssues(draft: OrderDraft): OrderIssue[] {
  const stopPrice = parsePositive(draft.stopPriceInput)
  if (stopPrice !== null) return []
  return [{ field: 'stopPrice', message: 'Enter a stop price greater than 0.' }]
}

function twapDurationIssues(draft: OrderDraft): OrderIssue[] {
  const minutes = twapDurationMinutes(draft)
  const isWithinClamp = minutes >= MOCK_MIN_TWAP_DURATION_MINUTES && minutes <= MOCK_MAX_TWAP_DURATION_MINUTES
  if (isWithinClamp) return []
  return [
    {
      field: 'twapDuration',
      message: `TWAP running time must be between ${MOCK_MIN_TWAP_DURATION_MINUTES}m and ${MOCK_MAX_TWAP_DURATION_MINUTES}m.`,
    },
  ]
}

/**
 * The mock venue's order validation + preview implementation (ADR-0035 D-1).
 * One parser shared between `validateDraft` (pre-check) and the `PlaceOrderRequest`
 * `placeOrder` consumes, so the client pre-check can never drift from acceptance.
 */
export function createMockOrderValidation(deps: MockOrderValidationDeps): MockOrderValidation {
  function buildRequest(draft: OrderDraft, symbol: string, coinSize: number): Result<PlaceOrderRequest, OrderIssue[]> {
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
      const price = parsePositive(draft.priceInput) ?? 0
      return ok({ ...base, orderType: 'limit', price, timeInForce: draft.timeInForce })
    }
    if (draft.orderType === 'stop-market') {
      const stopPrice = parsePositive(draft.stopPriceInput) ?? 0
      return ok({
        ...base,
        orderType: 'stop-market',
        stopPrice,
        slippageTolerance: resolveSlippageFraction(draft),
      })
    }
    if (draft.orderType === 'stop-limit') {
      const stopPrice = parsePositive(draft.stopPriceInput) ?? 0
      const price = parsePositive(draft.priceInput) ?? 0
      return ok({
        ...base,
        orderType: 'stop-limit',
        stopPrice,
        price,
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

  function collectIssues(draft: OrderDraft, symbol: string, coinSize: number): OrderIssue[] {
    const markPrice = deps.markPriceFor(symbol)
    const issues = [...sizeIssues(coinSize)]
    const isMarket = draft.orderType === 'market'
    const isLimit = draft.orderType === 'limit'
    const isStopMarket = draft.orderType === 'stop-market'
    const isStopLimit = draft.orderType === 'stop-limit'
    const isTwap = draft.orderType === 'twap'
    const usesLimitPrice = isLimit || isStopLimit
    const usesStopPrice = isStopMarket || isStopLimit
    const usesSlippage = isMarket || isStopMarket
    if (usesLimitPrice) issues.push(...limitPriceIssues(draft))
    if (usesStopPrice) issues.push(...stopPriceIssues(draft))
    if (usesSlippage) issues.push(...slippageIssues(draft))
    if (isTwap) issues.push(...twapDurationIssues(draft))
    issues.push(...notionalIssues(coinSize, markPrice, draft.reduceOnly))
    return issues
  }

  function validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]> {
    const symbol = draft.symbol
    const isNoMarket = symbol === ''
    if (isNoMarket) return err([{ message: 'No market selected.' }])
    const markPrice = deps.markPriceFor(symbol)
    const coinSize = resolveCoinSize(draft, markPrice)
    const issues = collectIssues(draft, symbol, coinSize)
    const hasIssues = issues.length > 0
    if (hasIssues) return err(issues)
    return buildRequest(draft, symbol, coinSize)
  }

  function previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity } {
    const symbol = draft.symbol
    const markPrice = deps.markPriceFor(symbol)
    const coinSize = resolveCoinSize(draft, markPrice)
    const notional = coinSize > 0 && markPrice > 0 ? roundTo(coinSize * markPrice, USD_DECIMALS) : 0
    const fee = roundTo(notional * MOCK_TAKER_RATE, USD_DECIMALS)
    const availableMargin = deps.availableMarginFor(symbol)
    const power = availableMargin > 0 && draft.leverage > 0 ? availableMargin * draft.leverage : 0
    const maxCoinSize = markPrice > 0 ? roundTo(power / markPrice, COIN_DECIMALS) : 0
    const capacity: OrderCapacity = { maxCoinSize }

    if (draft.orderType === 'twap') {
      const runtimeMinutes = twapDurationMinutes(draft)
      const runtimeSeconds = runtimeMinutes * 60
      const numberOfOrders = runtimeMinutes > 0 ? Math.floor(runtimeSeconds / MOCK_TWAP_FREQUENCY_SECONDS) + 1 : 0
      const sizePerSuborder = numberOfOrders > 0 ? roundTo(coinSize / numberOfOrders, COIN_DECIMALS) : 0
      const estimates: OrderEstimates = {
        kind: 'twap',
        notional,
        frequencySeconds: MOCK_TWAP_FREQUENCY_SECONDS,
        runtimeMinutes,
        numberOfOrders,
        sizePerSuborder,
        fee,
        hasBuilderFee: false,
      }
      return { estimates, capacity }
    }

    const margin = draft.leverage > 0 ? roundTo(notional / draft.leverage, USD_DECIMALS) : 0
    const isMarket = draft.orderType === 'market'
    const isLong = draft.side === 'buy'
    const inverseLeverage = draft.leverage > 0 ? 1 / draft.leverage : 0
    const longLiquidation = markPrice * (1 - inverseLeverage)
    const shortLiquidation = markPrice * (1 + inverseLeverage)
    const rawLiquidation = isLong ? longLiquidation : shortLiquidation
    const liquidationPrice = isMarket && markPrice > 0 && rawLiquidation > 0 ? roundTo(rawLiquidation, USD_DECIMALS) : 0
    const estimates: OrderEstimates = {
      kind: 'linear',
      notional,
      margin,
      liquidationPrice,
      fee,
      hasBuilderFee: false,
    }
    return { estimates, capacity }
  }

  return { validateDraft, previewOrder }
}
