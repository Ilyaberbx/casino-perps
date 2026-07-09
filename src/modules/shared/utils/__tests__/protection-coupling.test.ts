import { describe, it, expect } from 'vitest'
import {
  coupleFromAmountInput,
  coupleFromPriceInput,
  deriveAmountInput,
  deriveTriggerPrice,
  isLegPopulated,
  isLegValid,
  reprojectLegToBasis,
  triggerKindFor,
} from '../protection-coupling'
import type { DeriveTriggerContext } from '../protection-coupling.types'

function ctx(overrides: Partial<DeriveTriggerContext>): DeriveTriggerContext {
  return {
    kind: 'take-profit',
    basis: 'usd',
    side: 'buy',
    referencePrice: 60_000,
    size: 1,
    ...overrides,
  }
}

describe('triggerKindFor', () => {
  it('maps the draft leg slot to its trigger kind', () => {
    expect(triggerKindFor('takeProfit')).toBe('take-profit')
    expect(triggerKindFor('stopLoss')).toBe('stop-loss')
  })
})

describe('isLegPopulated', () => {
  it('is false for an empty leg', () => {
    expect(isLegPopulated({ priceInput: '', amountInput: '' })).toBe(false)
  })

  it('is true when either field carries input', () => {
    expect(isLegPopulated({ priceInput: '65000', amountInput: '' })).toBe(true)
    expect(isLegPopulated({ priceInput: '', amountInput: '10' })).toBe(true)
  })
})

describe('deriveTriggerPrice', () => {
  it('uses an explicit price when present', () => {
    expect(deriveTriggerPrice({ priceInput: '65000', amountInput: '' }, ctx({}))).toBe(65_000)
  })

  it('returns null for an empty leg', () => {
    expect(deriveTriggerPrice({ priceInput: '', amountInput: '' }, ctx({}))).toBeNull()
  })

  it('projects a percent gain off the reference (long take-profit above entry)', () => {
    const draft = { priceInput: '', amountInput: '10' }
    expect(deriveTriggerPrice(draft, ctx({ basis: 'percent' }))).toBeCloseTo(66_000, 5)
  })

  it('projects a percent loss off the reference (long stop-loss below entry)', () => {
    const draft = { priceInput: '', amountInput: '10' }
    expect(deriveTriggerPrice(draft, ctx({ basis: 'percent', kind: 'stop-loss' }))).toBeCloseTo(
      54_000,
      5,
    )
  })

  it('projects a $ gain by size (long take-profit above entry)', () => {
    const draft = { priceInput: '', amountInput: '3000' }
    expect(deriveTriggerPrice(draft, ctx({ basis: 'usd', size: 1 }))).toBeCloseTo(63_000, 5)
  })

  it('flips direction for a short take-profit (below entry)', () => {
    const draft = { priceInput: '', amountInput: '10' }
    expect(deriveTriggerPrice(draft, ctx({ basis: 'percent', side: 'sell' }))).toBeCloseTo(54_000, 5)
  })
})

describe('deriveAmountInput (price → gain/loss, inverse coupling)', () => {
  it('projects a $ gain off the reference by size (long take-profit)', () => {
    expect(deriveAmountInput(63_000, ctx({ basis: 'usd', size: 1 }))).toBe('3000')
  })

  it('projects a % gain off the reference (long take-profit)', () => {
    expect(deriveAmountInput(66_000, ctx({ basis: 'percent' }))).toBe('10')
  })

  it('is a positive magnitude for a stop-loss below entry', () => {
    expect(deriveAmountInput(54_000, ctx({ basis: 'percent', kind: 'stop-loss' }))).toBe('10')
  })

  it('returns empty when no reference price is available', () => {
    expect(deriveAmountInput(63_000, ctx({ referencePrice: 0 }))).toBe('')
  })

  it('returns empty for a $ basis with no size', () => {
    expect(deriveAmountInput(63_000, ctx({ basis: 'usd', size: 0 }))).toBe('')
  })

  it('round-trips a $ amount through price and back', () => {
    const price = deriveTriggerPrice({ priceInput: '', amountInput: '3000' }, ctx({ basis: 'usd' }))
    expect(price).not.toBeNull()
    expect(deriveAmountInput(price ?? 0, ctx({ basis: 'usd' }))).toBe('3000')
  })
})

describe('coupleFromPriceInput', () => {
  it('keeps the typed price verbatim and derives the gain/loss', () => {
    expect(coupleFromPriceInput('66000', ctx({ basis: 'percent' }))).toEqual({
      priceInput: '66000',
      amountInput: '10',
    })
  })

  it('clears the amount when the price is emptied', () => {
    expect(coupleFromPriceInput('', ctx({ basis: 'percent' }))).toEqual({
      priceInput: '',
      amountInput: '',
    })
  })
})

describe('coupleFromAmountInput', () => {
  it('keeps the typed amount verbatim and derives the price', () => {
    const result = coupleFromAmountInput('10', ctx({ basis: 'percent' }))
    expect(result.amountInput).toBe('10')
    expect(Number(result.priceInput)).toBeCloseTo(66_000, 5)
  })

  it('clears the price when the amount is emptied', () => {
    expect(coupleFromAmountInput('', ctx({ basis: 'percent' }))).toEqual({
      priceInput: '',
      amountInput: '',
    })
  })
})

describe('reprojectLegToBasis ($/% toggle)', () => {
  const base = { kind: 'take-profit' as const, side: 'buy' as const, referencePrice: 60_000, size: 1 }

  it('reprojects an explicit-price leg into % while holding the price fixed', () => {
    const next = reprojectLegToBasis({ priceInput: '66000', amountInput: '6000' }, base, 'percent')
    expect(next).toEqual({ priceInput: '66000', amountInput: '10' })
  })

  it('reprojects a $-amount leg into % off its derived price', () => {
    const next = reprojectLegToBasis({ priceInput: '', amountInput: '6000' }, base, 'percent')
    expect(Number(next.priceInput)).toBeCloseTo(66_000, 5)
    expect(next.amountInput).toBe('10')
  })

  it('reprojects a %-amount leg back into $', () => {
    const next = reprojectLegToBasis({ priceInput: '', amountInput: '10' }, base, 'usd')
    expect(next.amountInput).toBe('6000')
  })

  it('passes an empty leg through unchanged', () => {
    const next = reprojectLegToBasis({ priceInput: '', amountInput: '' }, base, 'percent')
    expect(next).toEqual({ priceInput: '', amountInput: '' })
  })
})

describe('isLegValid', () => {
  it('treats an unpopulated leg as valid', () => {
    expect(isLegValid({ priceInput: '', amountInput: '' }, ctx({}))).toBe(true)
  })

  it('is valid when a populated leg yields a positive trigger', () => {
    expect(isLegValid({ priceInput: '65000', amountInput: '' }, ctx({}))).toBe(true)
  })

  it('is invalid when a populated leg yields nothing', () => {
    expect(isLegValid({ priceInput: 'abc', amountInput: '' }, ctx({}))).toBe(false)
  })
})
