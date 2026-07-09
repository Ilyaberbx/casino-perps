import { describe, it, expect } from 'vitest'
import {
  buildEntryProtection,
  coupleFromAmountInput,
  coupleFromPriceInput,
  deriveAmountInput,
  deriveTriggerPrice,
  isLegValid,
  isProtectionValid,
  reprojectProtectionToBasis,
  triggerKindFor,
} from '../entry-protection.utils'
import type {
  EntryProtectionDraft,
  ProtectionContext,
  DeriveTriggerContext,
} from '../order-entry.types'

const CONTEXT: ProtectionContext = { side: 'buy', referencePrice: 60_000, size: 1 }

const EMPTY_LEG = { priceInput: '', amountInput: '' }

const DISABLED: EntryProtectionDraft = {
  enabled: false,
  basis: 'usd',
  takeProfit: { ...EMPTY_LEG },
  stopLoss: { ...EMPTY_LEG },
}

function ctx(overrides: Partial<DeriveTriggerContext>): DeriveTriggerContext {
  return { kind: 'take-profit', basis: 'usd', side: 'buy', referencePrice: 60_000, size: 1, ...overrides }
}

describe('deriveTriggerPrice', () => {
  it('uses an explicit price when present', () => {
    expect(deriveTriggerPrice({ priceInput: '65000', amountInput: '' }, ctx({}))).toBe(65_000)
  })

  it('returns null for an empty leg', () => {
    expect(deriveTriggerPrice({ priceInput: '', amountInput: '' }, ctx({}))).toBeNull()
  })

  it('projects a percent gain off the reference (long take-profit above entry)', () => {
    // 60_000 × (1 + 10/100) = 66_000
    const draft = { priceInput: '', amountInput: '10' }
    expect(deriveTriggerPrice(draft, ctx({ basis: 'percent' }))).toBeCloseTo(66_000, 5)
  })

  it('projects a percent loss off the reference (long stop-loss below entry)', () => {
    // 60_000 × (1 − 10/100) = 54_000
    const draft = { priceInput: '', amountInput: '10' }
    expect(
      deriveTriggerPrice(draft, ctx({ basis: 'percent', kind: 'stop-loss' })),
    ).toBeCloseTo(54_000, 5)
  })

  it('projects a $ gain by size (long take-profit above entry)', () => {
    // reference 60_000 + ($3000 / size 1) = 63_000
    const draft = { priceInput: '', amountInput: '3000' }
    expect(deriveTriggerPrice(draft, ctx({ basis: 'usd', size: 1 }))).toBeCloseTo(63_000, 5)
  })

  it('flips direction for a short take-profit (below entry)', () => {
    const draft = { priceInput: '', amountInput: '10' }
    expect(
      deriveTriggerPrice(draft, ctx({ basis: 'percent', side: 'sell' })),
    ).toBeCloseTo(54_000, 5)
  })
})

describe('triggerKindFor', () => {
  it('maps the draft leg slot to its trigger kind', () => {
    expect(triggerKindFor('takeProfit')).toBe('take-profit')
    expect(triggerKindFor('stopLoss')).toBe('stop-loss')
  })
})

describe('deriveAmountInput (price → gain/loss, inverse coupling)', () => {
  it('projects a $ gain off the reference by size (long take-profit)', () => {
    // |63_000 − 60_000| × size 1 = 3000
    expect(deriveAmountInput(63_000, ctx({ basis: 'usd', size: 1 }))).toBe('3000')
  })

  it('projects a % gain off the reference (long take-profit)', () => {
    // |66_000 − 60_000| / 60_000 × 100 = 10
    expect(deriveAmountInput(66_000, ctx({ basis: 'percent' }))).toBe('10')
  })

  it('is a positive magnitude for a stop-loss below entry', () => {
    // |54_000 − 60_000| / 60_000 × 100 = 10 (magnitude, direction implied by kind)
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

describe('reprojectProtectionToBasis ($/% toggle)', () => {
  it('reprojects an explicit-price leg into % while holding the price fixed', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { priceInput: '66000', amountInput: '6000' },
      stopLoss: { ...EMPTY_LEG },
    }
    const next = reprojectProtectionToBasis(draft, CONTEXT, 'percent')
    expect(next.basis).toBe('percent')
    // price held fixed at 66_000 → 10% ROI off 60_000
    expect(next.takeProfit).toEqual({ priceInput: '66000', amountInput: '10' })
  })

  it('reprojects a $-amount leg into % off its derived price', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { priceInput: '', amountInput: '6000' },
      stopLoss: { ...EMPTY_LEG },
    }
    const next = reprojectProtectionToBasis(draft, CONTEXT, 'percent')
    // $6000 over size 1 → price 66_000 → 10% ROI; derived price written back
    expect(Number(next.takeProfit.priceInput)).toBeCloseTo(66_000, 5)
    expect(next.takeProfit.amountInput).toBe('10')
  })

  it('reprojects a %-amount leg back into $', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'percent',
      takeProfit: { priceInput: '', amountInput: '10' },
      stopLoss: { ...EMPTY_LEG },
    }
    const next = reprojectProtectionToBasis(draft, CONTEXT, 'usd')
    // 10% → price 66_000 → $ amount = |66_000 − 60_000| × size 1 = 6000
    expect(next.takeProfit.amountInput).toBe('6000')
  })

  it('passes an empty leg through unchanged', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { ...EMPTY_LEG },
      stopLoss: { ...EMPTY_LEG },
    }
    const next = reprojectProtectionToBasis(draft, CONTEXT, 'percent')
    expect(next.takeProfit).toEqual(EMPTY_LEG)
    expect(next.stopLoss).toEqual(EMPTY_LEG)
  })

  it('preserves the enabled flag', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { ...EMPTY_LEG },
      stopLoss: { ...EMPTY_LEG },
    }
    expect(reprojectProtectionToBasis(draft, CONTEXT, 'percent').enabled).toBe(true)
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

describe('isProtectionValid', () => {
  it('is true when the section is disabled regardless of legs', () => {
    expect(isProtectionValid(DISABLED, CONTEXT)).toBe(true)
  })

  it('is true when enabled with valid legs', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { priceInput: '65000', amountInput: '' },
      stopLoss: { priceInput: '55000', amountInput: '' },
    }
    expect(isProtectionValid(draft, CONTEXT)).toBe(true)
  })

  it('is false when an enabled leg is populated but unusable', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { priceInput: 'abc', amountInput: '' },
      stopLoss: { ...EMPTY_LEG },
    }
    expect(isProtectionValid(draft, CONTEXT)).toBe(false)
  })
})

describe('buildEntryProtection', () => {
  it('returns empty when the section is disabled', () => {
    expect(buildEntryProtection(DISABLED, CONTEXT)).toEqual({})
  })

  it('builds explicit-price legs', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { priceInput: '66000', amountInput: '' },
      stopLoss: { priceInput: '54000', amountInput: '' },
    }
    expect(buildEntryProtection(draft, CONTEXT)).toEqual({
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 66_000 } },
      stopLoss: { kind: 'stop-loss', trigger: { type: 'price', price: 54_000 } },
    })
  })

  it('derives a percent take-profit into an absolute trigger price', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'percent',
      takeProfit: { priceInput: '', amountInput: '10' },
      stopLoss: { ...EMPTY_LEG },
    }
    const built = buildEntryProtection(draft, CONTEXT)
    expect(built.takeProfit).toEqual({
      kind: 'take-profit',
      trigger: { type: 'price', price: 66_000 },
    })
    expect(built.stopLoss).toBeUndefined()
  })

  it('omits a populated-but-unusable leg', () => {
    const draft: EntryProtectionDraft = {
      enabled: true,
      basis: 'usd',
      takeProfit: { priceInput: 'abc', amountInput: '' },
      stopLoss: { ...EMPTY_LEG },
    }
    expect(buildEntryProtection(draft, CONTEXT)).toEqual({})
  })
})
