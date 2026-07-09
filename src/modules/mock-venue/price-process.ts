import { ANCHOR_PRICES } from './mock-venue.constants'

const VOLATILITY_PER_STEP = 0.002

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

function combineSeed(symbol: string, seed: number, time: number): number {
  const symbolPart = symbolHash(symbol)
  const timePart = Math.imul((time / 100) | 0, 0x9e3779b9)
  const seedPart = Math.imul(seed | 0, 0x6d2b79f5)
  return (symbolPart ^ timePart ^ seedPart) >>> 0
}

function sampleBoxMuller(random: () => number): number {
  const uniformA = random()
  const uniformB = random()
  const safeA = Math.max(uniformA, 1e-12)
  return Math.sqrt(-2 * Math.log(safeA)) * Math.cos(2 * Math.PI * uniformB)
}

export function computePrice(
  symbol: string,
  seed: number,
  time: number,
): number {
  const anchorPrice = ANCHOR_PRICES[symbol] ?? 1000
  const combined = combineSeed(symbol, seed, time)
  const random = mulberry32(combined)
  const normalSample = sampleBoxMuller(random)
  const logPrice = Math.log(anchorPrice) + VOLATILITY_PER_STEP * normalSample
  return Math.exp(logPrice)
}
