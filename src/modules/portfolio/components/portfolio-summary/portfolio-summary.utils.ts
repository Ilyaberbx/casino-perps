import type { DirectionTone } from './portfolio-summary.types'

const PLACEHOLDER = '—'
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const SIGNED_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

export function formatCurrency(value: number | null): string {
  if (value === null) return PLACEHOLDER
  return CURRENCY_FORMATTER.format(value)
}

export function formatSignedCurrency(value: number | null): string {
  if (value === null) return PLACEHOLDER
  if (value === 0) return CURRENCY_FORMATTER.format(0)
  return SIGNED_CURRENCY_FORMATTER.format(value)
}

export function toneFromValue(value: number | null): DirectionTone {
  if (value === null || value === 0) return 'neutral'
  if (value > 0) return 'up'
  return 'down'
}
