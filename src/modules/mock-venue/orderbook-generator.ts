import { computePrice } from './price-process'
import type { OrderbookSnapshot, OrderbookDiff, OrderbookLevel } from '../shared/domain'

export const ORDERBOOK_DEPTH = 60

const TICK_SIZES: Record<string, number> = {
  'BTC-PERP': 0.5,
  'ETH-PERP': 0.05,
  'SOL-PERP': 0.01,
}

const DEFAULT_TICK_SIZE = 0.1

const BASE_SIZES: Record<string, number> = {
  'BTC-PERP': 2,
  'ETH-PERP': 10,
  'SOL-PERP': 100,
}

const DEFAULT_BASE_SIZE = 10

const DIFF_LEVELS_PER_SIDE = 9

/**
 * Price gap between adjacent *visible* book levels.
 *
 * The order book UI aggregates raw levels into buckets at its default tick
 * (≈ 10^(floor(log10(mark)) − 3) — mirrors trading `buildTickLadder`'s default).
 * If the mock spaced levels by the raw `tickSize` (0.5 for BTC) all 60 levels
 * would collapse into ~3 buckets, leaving the ladder mostly empty. So we step
 * levels by that display tick instead: each generated level lands in its own
 * bucket and the ladder fills to full depth (no dead bands). The price is still
 * snapped to the `tickSize` grid so it reads like a real venue price.
 */
function visibleLevelStep(midPrice: number, tickSize: number): number {
  const displayTick = Math.pow(10, Math.floor(Math.log10(midPrice)) - 3)
  const snapped = Math.round(displayTick / tickSize) * tickSize
  return Math.max(tickSize, snapped)
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let z = state
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

function symbolHash(symbol: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < symbol.length; index++) {
    hash ^= symbol.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function levelSeed(symbol: string, seed: number, time: number, side: number, level: number): number {
  const base = symbolHash(symbol) ^ (seed * 1000003) ^ (time | 0) ^ (side * 7919) ^ (level * 31337)
  return base >>> 0
}

// Snap a raw price onto the absolute `step` grid (multiples of `step`). Because
// every level — snapshot and diff, at any mid — snaps to the SAME global grid,
// the levels stay 1:1 with the book's tick buckets: no off-grid duplicates that
// re-merge under aggregation and erode the visible ladder down to a stub.
function snapToStep(price: number, step: number): number {
  return Math.round(price / step) * step
}

function generateBids(
  midPrice: number,
  step: number,
  baseSize: number,
  random: () => number,
): OrderbookLevel[] {
  const levels: OrderbookLevel[] = []
  for (let level = 0; level < ORDERBOOK_DEPTH; level++) {
    const price = midPrice - (level + 1) * step
    const decayFactor = 1 / (1 + level * 0.15)
    const sizeNoise = 0.5 + random()
    const size = Math.max(0.001, baseSize * decayFactor * sizeNoise)
    levels.push({ price: snapToStep(price, step), size })
  }
  return levels
}

function generateAsks(
  midPrice: number,
  step: number,
  baseSize: number,
  random: () => number,
): OrderbookLevel[] {
  const levels: OrderbookLevel[] = []
  for (let level = 0; level < ORDERBOOK_DEPTH; level++) {
    const price = midPrice + (level + 1) * step
    const decayFactor = 1 / (1 + level * 0.15)
    const sizeNoise = 0.5 + random()
    const size = Math.max(0.001, baseSize * decayFactor * sizeNoise)
    levels.push({ price: snapToStep(price, step), size })
  }
  return levels
}

export function generateSnapshot(
  symbol: string,
  seed: number,
  time: number,
  sequence: number,
): OrderbookSnapshot {
  const midPrice = computePrice(symbol, seed, time)
  const tickSize = TICK_SIZES[symbol] ?? DEFAULT_TICK_SIZE
  const baseSize = BASE_SIZES[symbol] ?? DEFAULT_BASE_SIZE
  const bidSeed = levelSeed(symbol, seed, time, 0, 0)
  const askSeed = levelSeed(symbol, seed, time, 1, 0)
  const bidRandom = mulberry32(bidSeed)
  const askRandom = mulberry32(askSeed)
  const step = visibleLevelStep(midPrice, tickSize)
  const bids = generateBids(midPrice, step, baseSize, bidRandom)
  const asks = generateAsks(midPrice, step, baseSize, askRandom)
  return {
    kind: 'snapshot',
    symbol,
    sequence,
    bids,
    asks,
    timestamp: time,
  }
}

export function generateDiff(
  symbol: string,
  seed: number,
  time: number,
  sequence: number,
): OrderbookDiff {
  const midPrice = computePrice(symbol, seed, time)
  const tickSize = TICK_SIZES[symbol] ?? DEFAULT_TICK_SIZE
  const baseSize = BASE_SIZES[symbol] ?? DEFAULT_BASE_SIZE
  const diffSeed = levelSeed(symbol, seed, time, 2, sequence)
  const random = mulberry32(diffSeed)
  // Same step as the snapshot so diff prices land on the same visible levels
  // (an update at a raw-tickSize offset would never match a snapshot bucket).
  const step = visibleLevelStep(midPrice, tickSize)

  const bids: OrderbookLevel[] = []
  const asks: OrderbookLevel[] = []

  for (let index = 0; index < DIFF_LEVELS_PER_SIDE; index++) {
    const level = Math.floor(random() * ORDERBOOK_DEPTH)
    const price = midPrice - (level + 1) * step
    const isDeletion = random() < 0.2
    const size = isDeletion ? 0 : Math.max(0.001, baseSize * (0.5 + random()))
    bids.push({ price: snapToStep(price, step), size })
  }

  for (let index = 0; index < DIFF_LEVELS_PER_SIDE; index++) {
    const level = Math.floor(random() * ORDERBOOK_DEPTH)
    const price = midPrice + (level + 1) * step
    const isDeletion = random() < 0.2
    const size = isDeletion ? 0 : Math.max(0.001, baseSize * (0.5 + random()))
    asks.push({ price: snapToStep(price, step), size })
  }

  return {
    kind: 'diff',
    symbol,
    sequence,
    bids,
    asks,
    timestamp: time,
  }
}
