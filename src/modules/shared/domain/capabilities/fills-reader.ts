import type { Fill, Unsubscribe } from '../domain.types'

export interface FillsReader {
  subscribe(onFill: (fill: Fill) => void): Unsubscribe
}
