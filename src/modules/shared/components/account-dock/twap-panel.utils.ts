import type { TwapHistoryStatus } from '@/modules/shared/domain'

const MS_PER_MINUTE = 60_000
const MS_PER_SECOND = 1_000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

/**
 * Average fill price of a (partially) executed TWAP = executed notional / executed
 * size. Returns `null` when nothing has executed yet (no meaningful average, and
 * avoids a divide-by-zero) — the caller renders `--`.
 */
export function twapAveragePrice(
  executedNotionalUsd: number,
  executedSize: number,
): number | null {
  if (executedSize <= 0) return null
  return executedNotionalUsd / executedSize
}

/**
 * Milliseconds left in a TWAP's run window: `createdAt + durationMinutes*60_000 −
 * now`, clamped at zero so a finished/overdue order never shows a negative
 * countdown. The caller passes `now` (a 1s tick) so the value re-derives each
 * second without the helper reading the clock.
 */
export function twapTimeRemainingMs(
  createdAt: number,
  durationMinutes: number,
  now: number,
): number {
  const endsAt = createdAt + durationMinutes * MS_PER_MINUTE
  const remaining = endsAt - now
  return remaining > 0 ? remaining : 0
}

/**
 * Progress of a TWAP as `executedSize / size`, clamped to `[0, 1]` so an
 * over-fill or a bad/zero total can never push the progress bar past full or
 * negative. Zero total size ⇒ `0` (avoid divide-by-zero).
 */
export function twapProgressFraction(executedSize: number, size: number): number {
  if (size <= 0) return 0
  const fraction = executedSize / size
  if (fraction <= 0) return 0
  if (fraction >= 1) return 1
  return fraction
}

/**
 * Human countdown for the Time Remaining cell — `Xh Ym Zs` (hours dropped under
 * an hour), seconds always two digits. Zero or negative ⇒ `Done` (the window has
 * elapsed; the snapshot reader drops the row shortly after).
 */
export function formatTwapTimeRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'Done'
  const totalSeconds = Math.floor(remainingMs / MS_PER_SECOND)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const secondsPart = `${String(seconds).padStart(2, '0')}s`
  const minutesPart = `${minutes}m ${secondsPart}`
  if (hours === 0) return minutesPart
  return `${hours}h ${minutesPart}`
}

/**
 * Title-cased label for a completed TWAP's status in the History sub-tab. HL's
 * `activated` literal means the order is still running, so it reads as `Active`
 * for parity with the reference; the other literals title-case directly.
 */
export function twapHistoryStatusLabel(status: TwapHistoryStatus): string {
  if (status === 'activated') return 'Active'
  if (status === 'finished') return 'Finished'
  if (status === 'terminated') return 'Terminated'
  return 'Error'
}

/** Yes/No label for an optional boolean column; absent ⇒ `--` (History tab's
 *  Reduce Only / Randomize cells). */
export function yesNoDash(value: boolean | undefined): string {
  if (value === undefined) return '--'
  return value ? 'Yes' : 'No'
}
