import type { Order, Unsubscribe } from '../domain.types'

export interface OpenOrdersReader {
  subscribe(onOrder: (order: Order) => void): Unsubscribe
}
