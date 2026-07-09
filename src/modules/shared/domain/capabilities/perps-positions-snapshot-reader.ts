import type { Unsubscribe } from '../domain.types'

/**
 * Snapshot of a single open perps position. Mirrors the shape Hyperliquid's
 * reference UI shows on the Positions tab: size + entry, current mark price,
 * unrealized PnL in USD, and ROE %.
 *
 * `roePct` is a percentage (e.g. `31.63` for +31.63%), not a ratio.
 */
export interface PerpPositionSnapshot {
  readonly symbol: string
  readonly side: 'long' | 'short'
  readonly size: number
  readonly entryPrice: number
  readonly markPrice: number
  readonly positionValueUsd: number
  readonly unrealizedPnlUsd: number
  readonly roePct: number
  readonly leverage: number
  readonly leverageType: 'cross' | 'isolated'
  readonly liquidationPrice: number | null
  readonly marginUsedUsd: number
}

/**
 * Snapshot-style capability: pushes the full array of open positions on each
 * upstream tick. Distinct from the event-style `PositionsReader` used by the
 * trading account dock — Portfolio rendering wants the full list, not a diff.
 */
export interface PerpsPositionsSnapshotReader {
  subscribe(
    onUpdate: (positions: ReadonlyArray<PerpPositionSnapshot>) => void,
  ): Unsubscribe
}
