import type { Result, ResultAsync } from 'neverthrow'
import type { Candle, CandleUpdate, Interval, Unsubscribe } from '../domain.types'

export type CandleErrorKind =
  | 'invalid-count'
  | 'invalid-symbol'
  | 'invalid-interval'
  | 'load-older-failed'

export class CandleError extends Error {
  readonly kind: CandleErrorKind
  constructor(kind: CandleErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'CandleError'
  }
}

export interface LoadOlderResult {
  readonly candles: Candle[]
  readonly reachedStart: boolean
}

export interface CandlesReader {
  getHistory(
    symbol: string,
    interval: Interval,
    count?: number,
  ): Result<Candle[], CandleError>
  /**
   * Fetch up to `count` candles strictly older than `beforeOpenTime` (ms epoch).
   * Returned candles are ascending by openTime and contain no overlap with the
   * caller's current oldest bar. `reachedStart` signals that no further pages
   * exist behind this one — callers should stop firing pan-back fetches.
   */
  loadOlder(
    symbol: string,
    interval: Interval,
    beforeOpenTime: number,
    count: number,
  ): ResultAsync<LoadOlderResult, CandleError>
  subscribe(
    symbol: string,
    interval: Interval,
    onUpdate: (update: CandleUpdate) => void,
  ): Unsubscribe
}
