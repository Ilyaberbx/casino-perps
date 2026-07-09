import { err, ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import type {
  OrderCapacity,
  OrderDraft,
  OrderEstimates,
  OrderIssue,
  PlaceOrderRequest,
} from '@/modules/shared/domain'

/**
 * A self-contained fake of the venue-owned order validation + preview surface
 * (ADR-0035) for `trading/` tests. `trading/` cannot import a venue module
 * (lint), so this mirrors the mock-venue / Hyperliquid validation semantics with
 * the per-test context (mark / available / spot) baked in via `config`. Used to
 * build the `Trader.validateDraft` / `previewOrder` methods the order-entry hook
 * now drives. See `mock-venue/services/mock-order-validation.ts` for the canon.
 */
export interface FakeOrderValidationConfig {
  symbol: string
  markPrice: number
  availableMargin: number
  isSpot?: boolean
  spotUsdcAvailable?: number
  spotBaseAvailable?: number
  takerRate?: number
  defaultSlippagePercent?: number
  maxSlippagePercent?: number
  minOrderValueUsd?: number
}

const PERCENT_DIVISOR = 100
const COIN_DECIMALS = 6
const USD_DECIMALS = 2
const TWAP_FREQUENCY_SECONDS = 30
const MIN_TWAP_MINUTES = 5
const MAX_TWAP_MINUTES = 1440

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function parsePositive(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseNonNegativeInt(input: string): number {
  const trimmed = input.trim()
  if (trimmed.length === 0) return 0
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

export function buildFakeOrderValidation(config: FakeOrderValidationConfig): {
  validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]>
  previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity }
} {
  const markPrice = config.markPrice
  const isSpot = config.isSpot ?? false
  const takerRate = config.takerRate ?? 0
  const defaultSlippage = config.defaultSlippagePercent ?? 8
  const maxSlippage = config.maxSlippagePercent ?? 50
  const minOrderValue = config.minOrderValueUsd ?? 10

  function twapMinutes(draft: OrderDraft): number {
    return parseNonNegativeInt(draft.twapHoursInput) * 60 + parseNonNegativeInt(draft.twapMinutesInput)
  }

  function resolveCoinSize(draft: OrderDraft): number {
    const raw = parsePositive(draft.sizeInput)
    if (raw === null) return 0
    if (draft.sizeUnit === 'coin') return roundTo(raw, COIN_DECIMALS)
    const leverage = isSpot ? 1 : draft.leverage
    if (!(markPrice > 0) || !(leverage > 0)) return 0
    return roundTo((raw * leverage) / markPrice, COIN_DECIMALS)
  }

  function slippageFraction(draft: OrderDraft): number {
    const parsed = parsePositive(draft.slippageInput)
    const percent = parsed === null ? defaultSlippage : Math.min(parsed, maxSlippage)
    return percent / PERCENT_DIVISOR
  }

  function collectIssues(draft: OrderDraft, coinSize: number): OrderIssue[] {
    const issues: OrderIssue[] = []
    if (coinSize <= 0) issues.push({ field: 'size', message: 'Enter an order size greater than 0.' })
    const usesLimit = draft.orderType === 'limit' || draft.orderType === 'stop-limit'
    const usesStop = draft.orderType === 'stop-market' || draft.orderType === 'stop-limit'
    const usesSlippage = draft.orderType === 'market' || draft.orderType === 'stop-market'
    if (usesLimit && parsePositive(draft.priceInput) === null) {
      issues.push({ field: 'price', message: 'Enter a limit price greater than 0.' })
    }
    if (usesStop && parsePositive(draft.stopPriceInput) === null) {
      issues.push({ field: 'stopPrice', message: 'Enter a stop price greater than 0.' })
    }
    if (usesSlippage) {
      const trimmed = draft.slippageInput.trim()
      const parsed = Number(trimmed)
      const isInvalid = trimmed.length > 0 && !(Number.isFinite(parsed) && parsed > 0)
      if (isInvalid) issues.push({ field: 'slippage', message: 'Slippage must be a positive percent.' })
    }
    if (draft.orderType === 'twap') {
      const minutes = twapMinutes(draft)
      const isWithin = minutes >= MIN_TWAP_MINUTES && minutes <= MAX_TWAP_MINUTES
      if (!isWithin) {
        issues.push({
          field: 'twapDuration',
          message: `TWAP running time must be between ${MIN_TWAP_MINUTES}m and ${MAX_TWAP_MINUTES}m.`,
        })
      }
    }
    const isExempt = draft.reduceOnly || markPrice <= 0 || coinSize <= 0
    const notional = coinSize * markPrice
    if (!isExempt && notional < minOrderValue) {
      issues.push({ field: 'size', message: `Minimum order value is $${minOrderValue}.` })
    }
    return issues
  }

  function buildRequest(draft: OrderDraft, coinSize: number): PlaceOrderRequest {
    // The draft is self-describing (ADR-0057): the built request names
    // `draft.symbol`, mirroring the real venues. `config.symbol` only seeds the
    // per-test mark / available lookups.
    const base = { symbol: draft.symbol, side: draft.side, size: coinSize, reduceOnly: draft.reduceOnly }
    if (draft.orderType === 'limit') {
      return { ...base, orderType: 'limit', price: parsePositive(draft.priceInput) ?? 0, timeInForce: draft.timeInForce }
    }
    if (draft.orderType === 'stop-market') {
      return { ...base, orderType: 'stop-market', stopPrice: parsePositive(draft.stopPriceInput) ?? 0, slippageTolerance: slippageFraction(draft) }
    }
    if (draft.orderType === 'stop-limit') {
      return { ...base, orderType: 'stop-limit', stopPrice: parsePositive(draft.stopPriceInput) ?? 0, price: parsePositive(draft.priceInput) ?? 0, timeInForce: draft.timeInForce }
    }
    if (draft.orderType === 'twap') {
      return { ...base, orderType: 'twap', durationMinutes: twapMinutes(draft), randomize: draft.randomize }
    }
    return { ...base, orderType: 'market', slippageTolerance: slippageFraction(draft) }
  }

  function validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]> {
    const coinSize = resolveCoinSize(draft)
    const issues = collectIssues(draft, coinSize)
    if (issues.length > 0) return err(issues)
    return ok(buildRequest(draft, coinSize))
  }

  function capacityFor(draft: OrderDraft): OrderCapacity {
    if (isSpot) {
      const isBuy = draft.side === 'buy'
      const usdc = config.spotUsdcAvailable ?? 0
      const base = config.spotBaseAvailable ?? 0
      const maxCoinSize = isBuy ? (markPrice > 0 ? roundTo(usdc / markPrice, COIN_DECIMALS) : 0) : base
      return { maxCoinSize }
    }
    const hasPower = config.availableMargin > 0 && draft.leverage > 0 && markPrice > 0
    const maxCoinSize = hasPower ? roundTo((config.availableMargin * draft.leverage) / markPrice, COIN_DECIMALS) : 0
    return { maxCoinSize }
  }

  function previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity } {
    const coinSize = resolveCoinSize(draft)
    const notional = coinSize > 0 && markPrice > 0 ? roundTo(coinSize * markPrice, USD_DECIMALS) : 0
    const fee = roundTo(notional * takerRate, USD_DECIMALS)
    const capacity = capacityFor(draft)
    if (draft.orderType === 'twap') {
      const runtimeMinutes = twapMinutes(draft)
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
        hasBuilderFee: false,
      }
      return { estimates, capacity }
    }
    const leverage = isSpot ? 1 : draft.leverage
    const margin = leverage > 0 ? roundTo(notional / leverage, USD_DECIMALS) : 0
    const showsLiquidation = draft.orderType === 'market' && !isSpot && markPrice > 0 && leverage > 0
    const inverseLeverage = leverage > 0 ? 1 / leverage : 0
    const rawLiquidation = draft.side === 'buy' ? markPrice * (1 - inverseLeverage) : markPrice * (1 + inverseLeverage)
    const liquidationPrice = showsLiquidation && rawLiquidation > 0 ? roundTo(rawLiquidation, USD_DECIMALS) : 0
    const estimates: OrderEstimates = { kind: 'linear', notional, margin, liquidationPrice, fee, hasBuilderFee: false }
    return { estimates, capacity }
  }

  return { validateDraft, previewOrder }
}
