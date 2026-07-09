import type { Order, Unsubscribe } from '../domain.types'

/**
 * Snapshot-style port for the Portfolio "Open Orders" tab. Pushes the full
 * current array of open orders on every upstream tick. Distinct from the
 * event-style `OpenOrdersReader` consumed by the trading-page account dock.
 */
export interface OpenOrdersSnapshotReader {
  subscribe(onUpdate: (orders: ReadonlyArray<Order>) => void): Unsubscribe
}
