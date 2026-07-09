import { describe, it, expect } from 'vitest'
import type { OrderDraft } from '../../../shared/domain'
import { createMockOrderValidation } from '../mock-order-validation'
import type { MockOrderValidationDeps } from '../../mock-venue.types'

const SYMBOL = 'BTC-PERP'
const MARK_PRICE = 65_000
const AVAILABLE_MARGIN = 900

function setup(overrides: Partial<MockOrderValidationDeps> = {}) {
  const deps: MockOrderValidationDeps = {
    markPriceFor: () => MARK_PRICE,
    availableMarginFor: () => AVAILABLE_MARGIN,
    ...overrides,
  }
  return createMockOrderValidation(deps)
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

/** Collect the OrderField tags from an err payload. */
function fieldsOf(result: ReturnType<ReturnType<typeof setup>['validateDraft']>): Array<string | undefined> {
  if (result.isOk()) return []
  return result.error.map((issue) => issue.field)
}

describe('createMockOrderValidation.validateDraft', () => {
  describe('market', () => {
    it('parses a valid market draft into a MarketOrderRequest', () => {
      const result = setup().validateDraft(baseDraft({ orderType: 'market', sizeInput: '0.01' }))
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value).toMatchObject({
        orderType: 'market',
        symbol: SYMBOL,
        side: 'buy',
        size: 0.01,
        slippageTolerance: 0.08,
      })
    })

    it('flags a missing size with field "size"', () => {
      const result = setup().validateDraft(baseDraft({ sizeInput: '' }))
      expect(fieldsOf(result)).toContain('size')
    })

    it('flags an order below the $10 min notional with field "size"', () => {
      // 0.0001 BTC × 65000 = $6.5 < $10.
      const result = setup().validateDraft(baseDraft({ sizeInput: '0.0001' }))
      expect(fieldsOf(result)).toContain('size')
    })

    it('exempts reduce-only orders from the min-notional check', () => {
      const result = setup().validateDraft(baseDraft({ sizeInput: '0.0001', reduceOnly: true }))
      expect(result.isOk()).toBe(true)
    })

    it('flags an out-of-band slippage with field "slippage"', () => {
      const result = setup().validateDraft(baseDraft({ slippageInput: '80' }))
      expect(fieldsOf(result)).toContain('slippage')
    })

    it('flags a negative slippage with field "slippage" (the originating bug)', () => {
      const result = setup().validateDraft(baseDraft({ slippageInput: '-5' }))
      expect(fieldsOf(result)).toContain('slippage')
    })

    it('accepts an in-band slippage and carries it as a fraction', () => {
      const result = setup().validateDraft(baseDraft({ slippageInput: '5' }))
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value).toMatchObject({ orderType: 'market', slippageTolerance: 0.05 })
    })

    it('resolves a usd-unit size into coin size via leverage', () => {
      // $100 margin × 10x / 65000 = 0.015384… coin.
      const result = setup().validateDraft(baseDraft({ sizeUnit: 'usd', sizeInput: '100' }))
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value.size).toBeCloseTo(0.015385, 5)
    })
  })

  describe('limit', () => {
    it('parses a valid limit draft into a LimitOrderRequest', () => {
      const result = setup().validateDraft(
        baseDraft({ orderType: 'limit', sizeInput: '0.01', priceInput: '64000', timeInForce: 'Alo' }),
      )
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value).toMatchObject({ orderType: 'limit', price: 64_000, timeInForce: 'Alo' })
    })

    it('flags a missing limit price with field "price"', () => {
      const result = setup().validateDraft(baseDraft({ orderType: 'limit', priceInput: '' }))
      expect(fieldsOf(result)).toContain('price')
    })
  })

  describe('stop-market', () => {
    it('parses a valid stop-market draft', () => {
      const result = setup().validateDraft(
        baseDraft({ orderType: 'stop-market', sizeInput: '0.01', stopPriceInput: '63000' }),
      )
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value).toMatchObject({ orderType: 'stop-market', stopPrice: 63_000 })
    })

    it('flags a missing stop price with field "stopPrice"', () => {
      const result = setup().validateDraft(baseDraft({ orderType: 'stop-market', stopPriceInput: '' }))
      expect(fieldsOf(result)).toContain('stopPrice')
    })
  })

  describe('stop-limit', () => {
    it('parses a valid stop-limit draft', () => {
      const result = setup().validateDraft(
        baseDraft({
          orderType: 'stop-limit',
          sizeInput: '0.01',
          stopPriceInput: '63000',
          priceInput: '62950',
        }),
      )
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value).toMatchObject({ orderType: 'stop-limit', stopPrice: 63_000, price: 62_950 })
    })

    it('flags both missing stop and limit prices', () => {
      const result = setup().validateDraft(
        baseDraft({ orderType: 'stop-limit', stopPriceInput: '', priceInput: '' }),
      )
      expect(fieldsOf(result)).toEqual(expect.arrayContaining(['price', 'stopPrice']))
    })
  })

  describe('twap', () => {
    it('parses a valid twap draft', () => {
      const result = setup().validateDraft(
        baseDraft({ orderType: 'twap', sizeInput: '0.01', twapHoursInput: '0', twapMinutesInput: '30', randomize: true }),
      )
      expect(result.isOk()).toBe(true)
      if (result.isErr()) throw new Error('expected ok')
      expect(result.value).toMatchObject({ orderType: 'twap', durationMinutes: 30, randomize: true })
    })

    it('flags a duration below 5m with field "twapDuration"', () => {
      const result = setup().validateDraft(
        baseDraft({ orderType: 'twap', twapHoursInput: '0', twapMinutesInput: '2' }),
      )
      expect(fieldsOf(result)).toContain('twapDuration')
    })

    it('flags a duration above 24h with field "twapDuration"', () => {
      const result = setup().validateDraft(
        baseDraft({ orderType: 'twap', twapHoursInput: '25', twapMinutesInput: '0' }),
      )
      expect(fieldsOf(result)).toContain('twapDuration')
    })
  })

  it('returns an untagged issue when the draft names no market', () => {
    const result = setup().validateDraft(baseDraft({ symbol: '' }))
    expect(result.isErr()).toBe(true)
    if (result.isOk()) throw new Error('expected err')
    expect(result.error[0].field).toBeUndefined()
  })

  // ADR-0057 — the venue resolves the market from `draft.symbol`. The mark dep
  // is keyed off the draft's symbol, not an ambient ticker.
  it('keys the mark-price dep off the draft symbol', () => {
    const seen: string[] = []
    setup({
      markPriceFor: (s) => {
        seen.push(s)
        return MARK_PRICE
      },
    }).validateDraft(baseDraft({ symbol: 'SOL-PERP', sizeInput: '1' }))
    expect(seen).toContain('SOL-PERP')
    expect(seen).not.toContain(SYMBOL)
  })
})

describe('createMockOrderValidation.previewOrder', () => {
  it('prices a linear market estimate (notional / margin / fee / liquidation)', () => {
    const { estimates, capacity } = setup().previewOrder(baseDraft({ orderType: 'market', sizeInput: '0.01' }))
    expect(estimates.kind).toBe('linear')
    if (estimates.kind !== 'linear') throw new Error('expected linear')
    expect(estimates.notional).toBeCloseTo(650, 2)
    expect(estimates.margin).toBeCloseTo(65, 2)
    expect(estimates.fee).toBeCloseTo(0.29, 2)
    // long at 10x: liq ≈ mark × (1 − 1/10) = 58500.
    expect(estimates.liquidationPrice).toBeCloseTo(58_500, 0)
    // capacity = available margin × leverage / mark = 900 × 10 / 65000.
    expect(capacity.maxCoinSize).toBeCloseTo(0.138462, 5)
  })

  it('omits the liquidation row for non-market types', () => {
    const { estimates } = setup().previewOrder(
      baseDraft({ orderType: 'limit', sizeInput: '0.01', priceInput: '64000' }),
    )
    if (estimates.kind !== 'linear') throw new Error('expected linear')
    expect(estimates.liquidationPrice).toBe(0)
  })

  it('prices a twap slicing estimate', () => {
    const { estimates } = setup().previewOrder(
      baseDraft({ orderType: 'twap', sizeInput: '0.6', twapHoursInput: '0', twapMinutesInput: '30' }),
    )
    expect(estimates.kind).toBe('twap')
    if (estimates.kind !== 'twap') throw new Error('expected twap')
    // 30m × 60 / 30 + 1 = 61 sub-orders.
    expect(estimates.numberOfOrders).toBe(61)
    expect(estimates.frequencySeconds).toBe(30)
    expect(estimates.sizePerSuborder).toBeCloseTo(0.6 / 61, 5)
  })
})
