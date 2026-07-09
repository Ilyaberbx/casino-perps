import type { Position, Unsubscribe } from '../domain.types'

export interface PositionsReader {
  subscribe(onPosition: (position: Position) => void): Unsubscribe
}
