import { describe, expect, it } from 'vitest'
import {
  formatSuggestionCost,
  resolveSuggestionCostUsd,
} from '../trading.config'

describe('resolveSuggestionCostUsd', () => {
  it('falls back to the default when the override is missing', () => {
    expect(resolveSuggestionCostUsd({})).toBeGreaterThan(0)
  })

  it('uses a valid positive override', () => {
    expect(resolveSuggestionCostUsd({ VITE_MINARA_SUGGESTION_COST_USD: '0.10' })).toBe(0.1)
  })

  it('ignores a non-numeric override', () => {
    const fallback = resolveSuggestionCostUsd({})
    expect(resolveSuggestionCostUsd({ VITE_MINARA_SUGGESTION_COST_USD: 'free' })).toBe(fallback)
  })

  it('ignores a non-positive override', () => {
    const fallback = resolveSuggestionCostUsd({})
    expect(resolveSuggestionCostUsd({ VITE_MINARA_SUGGESTION_COST_USD: '0' })).toBe(fallback)
  })
})

describe('formatSuggestionCost', () => {
  it('formats USD with two decimals', () => {
    expect(formatSuggestionCost(0.05)).toBe('$0.05')
  })
})
