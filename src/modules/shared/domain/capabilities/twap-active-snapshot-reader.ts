import type { Side, Unsubscribe } from '../domain.types'

export interface ActiveTwap {
  readonly identifier: string
  readonly symbol: string
  readonly side: Side
  readonly size: number
  readonly executedSize: number
  readonly executedNotionalUsd: number
  readonly durationMinutes: number
  readonly reduceOnly: boolean
  readonly randomize: boolean
  readonly createdAt: number
}

/**
 * Snapshot-style port for the "Active TWAPs" section of the Portfolio TWAP
 * tab. Pushes the full array of currently-running TWAP orders on every
 * upstream tick (sourced from the same `webData2` stream as positions).
 */
export interface TwapActiveSnapshotReader {
  subscribe(onUpdate: (twaps: ReadonlyArray<ActiveTwap>) => void): Unsubscribe
}
