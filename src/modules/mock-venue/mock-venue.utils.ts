import type { OrderbookLevel, OrderbookUpdate } from '../shared/domain'
import type { BookState } from './mock-venue.types'
import {
  DISPLAY_DEPTH,
  MIN_ACK_LATENCY_MILLISECONDS,
  MAX_ACK_LATENCY_MILLISECONDS,
} from './mock-venue.constants'

/**
 * Pure generators/helpers extracted from `create-mock-venue.ts` (ADR-0008 —
 * one factory per capability needs testable seams). Everything here is pure:
 * no closure capture, no module state. The one stateful helper in the factory
 * (`nextIdentifier`, which holds a counter) intentionally stays there.
 */

export function currentTimestamp(): number {
  return Date.now()
}

export function samplePoisson(random: () => number, rate: number): number {
  const threshold = Math.exp(-rate)
  let count = 0
  let product = random()
  while (product > threshold) {
    count += 1
    product *= random()
  }
  return count
}

export function applyDiff(
  current: OrderbookLevel[],
  updates: OrderbookLevel[],
  isDescending: boolean,
): OrderbookLevel[] {
  const priceMap = new Map<number, number>()
  for (const level of current) {
    priceMap.set(level.price, level.size)
  }
  for (const update of updates) {
    const isDeletion = update.size === 0
    if (isDeletion) {
      priceMap.delete(update.price)
    } else {
      priceMap.set(update.price, update.size)
    }
  }
  const result = Array.from(priceMap.entries()).map(([price, size]) => ({
    price,
    size,
  }))
  result.sort((levelA, levelB) =>
    isDescending ? levelB.price - levelA.price : levelA.price - levelB.price,
  )
  return result.slice(0, DISPLAY_DEPTH)
}

export function createBookState(): BookState {
  return {
    bids: [],
    asks: [],
    recentPriceDrift: 0,
    lastMidPrice: 0,
  }
}

export function updateBookState(state: BookState, update: OrderbookUpdate): BookState {
  const isSnapshot = update.kind === 'snapshot'
  const nextBids = isSnapshot
    ? update.bids.slice(0, DISPLAY_DEPTH)
    : applyDiff(state.bids, update.bids, true)
  const nextAsks = isSnapshot
    ? update.asks.slice(0, DISPLAY_DEPTH)
    : applyDiff(state.asks, update.asks, false)

  const bestBid = nextBids[0]?.price ?? 0
  const bestAsk = nextAsks[0]?.price ?? 0
  const isBookPopulated = bestBid > 0 && bestAsk > 0
  const currentMidPrice = isBookPopulated ? (bestBid + bestAsk) / 2 : state.lastMidPrice
  const hasPreviousPrice = state.lastMidPrice > 0
  const priceMoved = hasPreviousPrice && currentMidPrice > 0
  const rawDrift = priceMoved ? (currentMidPrice - state.lastMidPrice) / state.lastMidPrice : 0
  const clampedDrift = Math.max(-1, Math.min(1, rawDrift * 1000))

  return {
    bids: nextBids,
    asks: nextAsks,
    recentPriceDrift: clampedDrift,
    lastMidPrice: currentMidPrice,
  }
}

export function sampleAckLatencyMilliseconds(rng: () => number): number {
  const range = MAX_ACK_LATENCY_MILLISECONDS - MIN_ACK_LATENCY_MILLISECONDS
  return Math.floor(rng() * range) + MIN_ACK_LATENCY_MILLISECONDS
}

export function delayMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
