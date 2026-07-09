import type { Unsubscribe } from '../domain.types'

/**
 * One row of the user's daily volume history.
 *
 * `date` is an ISO date (YYYY-MM-DD) in UTC, as returned by Hyperliquid.
 * Volumes are in USD notional. `exchange` is the venue-wide total for that
 * day; `userMaker` / `userTaker` are the user's weighted add-liquidity and
 * cross-trade volumes respectively.
 */
export interface VolumeHistoryEntry {
  readonly date: string
  readonly exchangeVolume: number
  readonly userMakerVolume: number
  readonly userTakerVolume: number
}

export interface VolumeHistory {
  readonly entries: ReadonlyArray<VolumeHistoryEntry>
}

export interface VolumeHistoryReader {
  subscribe(onUpdate: (history: VolumeHistory) => void): Unsubscribe
}
