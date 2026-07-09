import { describe, it, expect } from 'vitest'
import type { OrderDraft } from '@/modules/shared/domain'
import { createHyperliquidOrderValidation } from '../hyperliquid-order-validation'
import type {
  HyperliquidAssetInfo,
  HyperliquidOrderValidationDeps,
  HyperliquidValidationPosition,
} from '../hyperliquid-trader.types'

const SYMBOL = 'BTC-PERP'
const MARK_PRICE = 65_000
const AVAILABLE_MARGIN = 900
// BTC's real szDecimals. Price decimal cap = 6 − 5 = 1; size lot-step cap = 5.
const BTC_ASSET: HyperliquidAssetInfo = { assetId: 0, szDecimals: 5, marketType: 'perp' }

function setup(overrides: Partial<HyperliquidOrderValidationDeps> = {}) {
  const deps: HyperliquidOrderValidationDeps = {
    markPriceFor: () => MARK_PRICE,
    resolveAsset: () => BTC_ASSET,
    currentPositionFor: () => null,
    availableMarginFor: () => AVAILABLE_MARGIN,
    spotAvailableFor: () => 0,
    isSpotMarket: () => false,
    takerRate: () => 0.00045,
    hasBuilderFee: true,
    ...overrides,
  }
  return createHyperliquidOrderValidation(deps)
}

function baseDraft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    symbol: SYMBOL,
    orderType: 'market',
    side: 'buy',
    sizeUnit: 'coin',
    sizeInput: '0.01',
    priceInput: '',
    stopPriceInput: '',
    slippageInput: '',
    timeInForce: 'Gtc',
    twapHoursInput: '0',
    twapMinutesInput: '30',
    randomize: false,
    reduceOnly: false,
    leverage: 10,
    ...overrides,
  }
}

function fieldsOf(result: ReturnType<ReturnType<typeof setup>['validateDraft']>): Array<string | undefined> {
  if (result.isOk()) return []
  return result.error.map((issue) => issue.field)
}

describe('createHyperliquidOrderValidation.validateDraft', () => {
  it('parses a valid market draft into a MarketOrderRequest (default slippage 0.05)', () => {
    const result = setup().validateDraft(baseDraft({ orderType: 'market', sizeInput: '0.01' }))
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value).toMatchObject({
      orderType: 'market',
      symbol: SYMBOL,
      side: 'buy',
      size: 0.01,
      slippageTolerance: 0.05,
    })
  })

  it('flags a missing size with field "size"', () => {
    expect(fieldsOf(setup().validateDraft(baseDraft({ sizeInput: '' })))).toContain('size')
  })

  it('flags an order below the $10 min notional with field "size"', () => {
    // 0.0001 BTC × 65000 = $6.5 < $10.
    expect(fieldsOf(setup().validateDraft(baseDraft({ sizeInput: '0.0001' })))).toContain('size')
  })

  it('exempts reduce-only orders from the min-notional check', () => {
    // A buy reduce-only reduces an open short (S6) — seed one so the order is a
    // valid reduce and only the min-notional exemption is under test.
    const position: HyperliquidValidationPosition = { side: 'sell', size: 1 }
    const validation = setup({ currentPositionFor: () => position })
    expect(validation.validateDraft(baseDraft({ sizeInput: '0.0001', reduceOnly: true })).isOk()).toBe(true)
  })

  it('flags a negative slippage with field "slippage" (the originating bug)', () => {
    expect(fieldsOf(setup().validateDraft(baseDraft({ slippageInput: '-5' })))).toContain('slippage')
  })

  it('accepts an in-band slippage and carries it as a fraction', () => {
    const result = setup().validateDraft(baseDraft({ slippageInput: '5' }))
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value).toMatchObject({ orderType: 'market', slippageTolerance: 0.05 })
  })

  it('clamps an over-cap slippage to the venue max', () => {
    const result = setup().validateDraft(baseDraft({ slippageInput: '80' }))
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value).toMatchObject({ orderType: 'market', slippageTolerance: 0.5 })
  })

  it('resolves a usd-unit size into coin size via leverage', () => {
    // $100 margin × 10x / 65000 = 0.015384… coin.
    const result = setup().validateDraft(baseDraft({ sizeUnit: 'usd', sizeInput: '100' }))
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value.size).toBeCloseTo(0.015385, 5)
  })

  it('flags a missing limit price with field "price"', () => {
    expect(fieldsOf(setup().validateDraft(baseDraft({ orderType: 'limit', priceInput: '' })))).toContain('price')
  })

  it('parses a valid limit draft carrying the time-in-force', () => {
    const result = setup().validateDraft(
      baseDraft({ orderType: 'limit', sizeInput: '0.01', priceInput: '64000', timeInForce: 'Alo' }),
    )
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value).toMatchObject({ orderType: 'limit', price: 64_000, timeInForce: 'Alo' })
  })

  it('flags a missing stop price with field "stopPrice"', () => {
    expect(
      fieldsOf(setup().validateDraft(baseDraft({ orderType: 'stop-market', stopPriceInput: '' }))),
    ).toContain('stopPrice')
  })

  it('flags both missing stop and limit prices for stop-limit', () => {
    const result = setup().validateDraft(baseDraft({ orderType: 'stop-limit', stopPriceInput: '', priceInput: '' }))
    expect(fieldsOf(result)).toEqual(expect.arrayContaining(['price', 'stopPrice']))
  })

  it('flags a TWAP duration below 5m with field "twapDuration"', () => {
    expect(
      fieldsOf(setup().validateDraft(baseDraft({ orderType: 'twap', twapHoursInput: '0', twapMinutesInput: '2' }))),
    ).toContain('twapDuration')
  })

  it('flags a TWAP duration above 24h with field "twapDuration"', () => {
    expect(
      fieldsOf(setup().validateDraft(baseDraft({ orderType: 'twap', twapHoursInput: '25', twapMinutesInput: '0' }))),
    ).toContain('twapDuration')
  })

  it('parses a valid twap draft', () => {
    const result = setup().validateDraft(
      baseDraft({ orderType: 'twap', sizeInput: '0.01', twapMinutesInput: '30', randomize: true }),
    )
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value).toMatchObject({ orderType: 'twap', durationMinutes: 30, randomize: true })
  })

  it('returns an untagged issue when the draft names no market', () => {
    const result = setup().validateDraft(baseDraft({ symbol: '' }))
    expect(result.isErr()).toBe(true)
    if (result.isOk()) throw new Error('expected err')
    expect(result.error[0].field).toBeUndefined()
  })

  // ADR-0057 — the draft is self-describing: per-market deps are keyed off
  // `draft.symbol`, never an ambient active ticker. A SOL draft validates
  // against SOL even if the terminal's market would have been BTC.
  it('resolves every per-market dep from the draft symbol, not an ambient ticker', () => {
    const SOL = 'SOL-PERP'
    const SOL_ASSET: HyperliquidAssetInfo = { assetId: 5, szDecimals: 2, marketType: 'perp' }
    const markSeen: string[] = []
    const assetSeen: string[] = []
    const positionSeen: string[] = []
    const validation = setup({
      markPriceFor: (s) => {
        markSeen.push(s)
        return 150
      },
      resolveAsset: (s) => {
        assetSeen.push(s)
        return SOL_ASSET
      },
      currentPositionFor: (s) => {
        positionSeen.push(s)
        return null
      },
    })
    const result = validation.validateDraft(baseDraft({ symbol: SOL, sizeInput: '1' }))
    expect(result.isOk()).toBe(true)
    if (result.isErr()) throw new Error('expected ok')
    expect(result.value.symbol).toBe(SOL)
    expect(markSeen).toContain(SOL)
    expect(markSeen).not.toContain(SYMBOL)
    expect(assetSeen).toEqual([SOL])
    expect(positionSeen).toEqual([SOL])
  })
})

// S3 — price tick / precision (tickRejected). Use a low-szDecimals asset so the
// decimal cap bites, and a separate spot asset to cover the (8 − szDecimals) rule.
describe('createHyperliquidOrderValidation price-tick rule (S3)', () => {
  // szDecimals 1 → perp price decimal cap = 6 − 1 = 5; sig-fig cap = 5.
  const LOW_DEC_PERP: HyperliquidAssetInfo = { assetId: 1, szDecimals: 1, marketType: 'perp' }
  // szDecimals 4 → spot price decimal cap = 8 − 4 = 4; sig-fig cap = 5.
  const SPOT_ASSET: HyperliquidAssetInfo = { assetId: 2, szDecimals: 4, marketType: 'spot' }
  const perp = () => setup({ resolveAsset: () => LOW_DEC_PERP })
  // Spot mark 2.5; size 5 keeps notional (12.5) above the $10 min so only the
  // price-tick rule is under test.
  const spot = () => setup({ resolveAsset: () => SPOT_ASSET, isSpotMarket: () => true, markPriceFor: () => 2.5 })

  it('rejects a limit price with more than 5 significant figures (perp)', () => {
    // 123456 has 6 sig figs even though it is an integer-ish; use 1.23456 (6 sig).
    const result = perp().validateDraft(baseDraft({ orderType: 'limit', sizeInput: '0.1', priceInput: '1.23456' }))
    expect(fieldsOf(result)).toContain('price')
  })

  it('rejects a limit price with more decimals than (6 − szDecimals) (perp)', () => {
    // szDecimals 1 → max 5 decimals; 1.234567 has 6 decimals.
    const result = perp().validateDraft(baseDraft({ orderType: 'limit', sizeInput: '0.1', priceInput: '1.234567' }))
    expect(fieldsOf(result)).toContain('price')
  })

  it('accepts a valid-tick limit price and an integer price (perp)', () => {
    expect(perp().validateDraft(baseDraft({ orderType: 'limit', sizeInput: '0.1', priceInput: '1.2345' })).isOk()).toBe(
      true,
    )
    expect(perp().validateDraft(baseDraft({ orderType: 'limit', sizeInput: '0.1', priceInput: '64000' })).isOk()).toBe(
      true,
    )
  })

  it('rejects a spot price with more decimals than (8 − szDecimals)', () => {
    // szDecimals 4 → max 4 decimals; 2.12345 has 5 decimals.
    const result = spot().validateDraft(baseDraft({ orderType: 'limit', sizeInput: '5', priceInput: '2.12345' }))
    expect(fieldsOf(result)).toContain('price')
  })

  it('accepts a valid-tick spot price within (8 − szDecimals) decimals', () => {
    expect(spot().validateDraft(baseDraft({ orderType: 'limit', sizeInput: '5', priceInput: '2.1234' })).isOk()).toBe(
      true,
    )
  })

  it('rejects an over-precision stop-limit trigger price with field "stopPrice"', () => {
    const result = perp().validateDraft(
      baseDraft({ orderType: 'stop-limit', sizeInput: '0.1', stopPriceInput: '1.234567', priceInput: '64000' }),
    )
    expect(fieldsOf(result)).toContain('stopPrice')
  })
})

// S4 — size lot-step (szDecimals). Cover assets of differing szDecimals,
// including szDecimals 0 (whole-coin lots).
describe('createHyperliquidOrderValidation size lot-step rule (S4)', () => {
  const DEC_2: HyperliquidAssetInfo = { assetId: 3, szDecimals: 2, marketType: 'perp' }
  const DEC_0: HyperliquidAssetInfo = { assetId: 4, szDecimals: 0, marketType: 'perp' }
  // ETH's szDecimals (1-dp lot step). The slider must never emit a size finer
  // than this — the producer rounds to szDecimals so the validator never trips
  // (L1). This guard documents the contract the rounding obeys.
  const DEC_1: HyperliquidAssetInfo = { assetId: 5, szDecimals: 1, marketType: 'perp' }

  it('accepts a size rounded to szDecimals 1 (the L1 slider contract)', () => {
    expect(setup({ resolveAsset: () => DEC_1 }).validateDraft(baseDraft({ sizeInput: '0.3' })).isOk()).toBe(true)
  })

  it('rejects a 6-dp slider-style size on a 1-dp market (the L1 bug)', () => {
    const result = setup({ resolveAsset: () => DEC_1 }).validateDraft(baseDraft({ sizeInput: '0.333333' }))
    expect(fieldsOf(result)).toContain('size')
  })

  it('rejects a size with more decimals than szDecimals with field "size"', () => {
    // szDecimals 2 → 0.123 (3 decimals) over the lot step.
    const result = setup({ resolveAsset: () => DEC_2 }).validateDraft(baseDraft({ sizeInput: '0.123' }))
    expect(fieldsOf(result)).toContain('size')
  })

  it('accepts an exact-lot size at szDecimals 2', () => {
    expect(setup({ resolveAsset: () => DEC_2 }).validateDraft(baseDraft({ sizeInput: '0.12' })).isOk()).toBe(true)
  })

  it('rejects any fractional size when szDecimals is 0', () => {
    // markPrice 65000 keeps notional well above $10 so only the lot step bites.
    const result = setup({ resolveAsset: () => DEC_0 }).validateDraft(baseDraft({ sizeInput: '0.5' }))
    expect(fieldsOf(result)).toContain('size')
  })

  it('accepts a whole-coin size when szDecimals is 0', () => {
    expect(setup({ resolveAsset: () => DEC_0 }).validateDraft(baseDraft({ sizeInput: '1' })).isOk()).toBe(true)
  })
})

// S5 — trigger side-of-mark (badTriggerPxRejected). A long's (buy) stop sits
// below mark, a short's (sell) above. The take-profit cases are the inverse
// directions expressed through the order side. Mark is 65000.
describe('createHyperliquidOrderValidation trigger side-of-mark rule (S5)', () => {
  function stopDraft(overrides: Partial<OrderDraft>): OrderDraft {
    return baseDraft({ orderType: 'stop-market', sizeInput: '0.01', slippageInput: '5', ...overrides })
  }

  it('rejects a long stop-loss trigger above the mark (wrong side)', () => {
    const result = setup().validateDraft(stopDraft({ side: 'buy', stopPriceInput: '66000' }))
    expect(fieldsOf(result)).toContain('stopPrice')
  })

  it('accepts a long stop-loss trigger below the mark', () => {
    expect(setup().validateDraft(stopDraft({ side: 'buy', stopPriceInput: '64000' })).isOk()).toBe(true)
  })

  it('rejects a short stop-loss trigger below the mark (wrong side)', () => {
    const result = setup().validateDraft(stopDraft({ side: 'sell', stopPriceInput: '64000' }))
    expect(fieldsOf(result)).toContain('stopPrice')
  })

  it('accepts a short stop-loss trigger above the mark', () => {
    expect(setup().validateDraft(stopDraft({ side: 'sell', stopPriceInput: '66000' })).isOk()).toBe(true)
  })

  it('rejects a take-profit trigger on the wrong side (sell take-profit below mark)', () => {
    // A short-side (sell) take-profit fires above mark; below is the wrong side.
    const result = setup().validateDraft(stopDraft({ side: 'sell', stopPriceInput: '64000' }))
    expect(fieldsOf(result)).toContain('stopPrice')
  })

  it('accepts a take-profit trigger on the correct side (buy take-profit below mark)', () => {
    // A long-side (buy) take-profit fires below mark — the correct side here.
    expect(setup().validateDraft(stopDraft({ side: 'buy', stopPriceInput: '64000' })).isOk()).toBe(true)
  })
})

// S6 — reduce-only-reduces (reduceOnlyRejected). Seed a positions snapshot and
// cover: reduces OK / wrong side / oversized / flat (no position).
describe('createHyperliquidOrderValidation reduce-only-reduces rule (S6)', () => {
  function reduceDraft(overrides: Partial<OrderDraft>): OrderDraft {
    // sizeInput defaults to a value whose notional clears the $10 min so only
    // the reduce-only rule is exercised (reduce-only is min-notional exempt too).
    return baseDraft({ reduceOnly: true, sizeInput: '0.01', ...overrides })
  }
  const longPosition: HyperliquidValidationPosition = { side: 'buy', size: 0.02 }

  it('accepts a reduce-only order opposite a position and within its size', () => {
    const validation = setup({ currentPositionFor: () => longPosition })
    expect(validation.validateDraft(reduceDraft({ side: 'sell', sizeInput: '0.01' })).isOk()).toBe(true)
  })

  it('rejects a reduce-only order on the same side as the position with field "size"', () => {
    const validation = setup({ currentPositionFor: () => longPosition })
    expect(fieldsOf(validation.validateDraft(reduceDraft({ side: 'buy', sizeInput: '0.01' })))).toContain('size')
  })

  it('rejects a reduce-only order larger than the open position with field "size"', () => {
    const validation = setup({ currentPositionFor: () => longPosition })
    expect(fieldsOf(validation.validateDraft(reduceDraft({ side: 'sell', sizeInput: '0.05' })))).toContain('size')
  })

  it('rejects a reduce-only order when there is no open position with field "size"', () => {
    const validation = setup({ currentPositionFor: () => null })
    expect(fieldsOf(validation.validateDraft(reduceDraft({ side: 'sell', sizeInput: '0.01' })))).toContain('size')
  })
})

describe('createHyperliquidOrderValidation.previewOrder', () => {
  it('prices a linear market estimate (notional / margin / fee / liquidation) + capacity', () => {
    const { estimates, capacity } = setup().previewOrder(baseDraft({ orderType: 'market', sizeInput: '0.01' }))
    expect(estimates.kind).toBe('linear')
    if (estimates.kind !== 'linear') throw new Error('expected linear')
    expect(estimates.notional).toBeCloseTo(650, 2)
    expect(estimates.margin).toBeCloseTo(65, 2)
    // fee = notional × taker, rounded to cents: 650 × 0.00045 = 0.2925 → 0.29.
    expect(estimates.fee).toBeCloseTo(0.29, 2)
    expect(estimates.hasBuilderFee).toBe(true)
    // long at 10x: liq ≈ mark × (1 − 1/10) = 58500.
    expect(estimates.liquidationPrice).toBeCloseTo(58_500, 0)
    // capacity = available margin × leverage / mark = 900 × 10 / 65000.
    expect(capacity.maxCoinSize).toBeCloseTo(0.138462, 5)
  })

  it('omits the liquidation row for non-market types', () => {
    const { estimates } = setup().previewOrder(baseDraft({ orderType: 'limit', sizeInput: '0.01', priceInput: '64000' }))
    if (estimates.kind !== 'linear') throw new Error('expected linear')
    expect(estimates.liquidationPrice).toBe(0)
  })

  it('prices a twap slicing estimate (30m → 61 orders at 30s)', () => {
    const { estimates } = setup().previewOrder(
      baseDraft({ orderType: 'twap', sizeInput: '0.61', twapMinutesInput: '30' }),
    )
    expect(estimates.kind).toBe('twap')
    if (estimates.kind !== 'twap') throw new Error('expected twap')
    expect(estimates.numberOfOrders).toBe(61)
    expect(estimates.frequencySeconds).toBe(30)
    expect(estimates.sizePerSuborder).toBeCloseTo(0.61 / 61, 5)
  })

  it('sizes spot capacity off the side-relevant balance', () => {
    const validation = setup({
      isSpotMarket: () => true,
      spotAvailableFor: (_symbol, side) => (side === 'buy' ? 100 : 30),
    })
    const buy = validation.previewOrder(baseDraft({ side: 'buy' }))
    // buy: USDC 100 ÷ mark 65000.
    expect(buy.capacity.maxCoinSize).toBeCloseTo(100 / 65_000, 6)
    const sell = validation.previewOrder(baseDraft({ side: 'sell' }))
    expect(sell.capacity.maxCoinSize).toBe(30)
  })
})
