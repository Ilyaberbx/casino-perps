import type { FeeSchedule, VolumeTierRow } from '@/modules/shared/domain'
import type { MarketType } from './fee-schedule-modal.types'

const RATE_EPSILON = 1e-9

export function formatPercent(rate: number, fractionDigits = 3): string {
  const pct = rate * 100
  const trimmed = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(fractionDigits)
  return `${trimMantissa(trimmed)}%`
}

function trimMantissa(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/\.?0+$/, '')
}

export function formatNotionalCutoff(rowIndex: number, cutoff: number): string {
  if (rowIndex === 0) return `≤ ${formatMillions(cutoff)}`
  return `> ${formatMillions(cutoff)}`
}

function formatMillions(amount: number): string {
  if (amount >= 1_000_000_000) return `$${amount / 1_000_000_000}B`
  if (amount >= 1_000_000) return `$${amount / 1_000_000}M`
  return `$${amount}`
}

export function isActiveTierRow(
  row: VolumeTierRow,
  marketType: MarketType,
  schedule: FeeSchedule,
): boolean {
  const taker = marketType === 'spot' ? row.spotTaker : row.perpsTaker
  const userTaker = marketType === 'spot' ? schedule.userSpotTakerRate : schedule.userPerpsTakerRate
  return Math.abs(taker - userTaker) < RATE_EPSILON
}
