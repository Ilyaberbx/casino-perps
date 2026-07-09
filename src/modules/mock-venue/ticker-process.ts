import type { PerpTicker } from '../shared/domain'
import { computePrice } from './price-process'
import { ANCHOR_PRICES } from './mock-venue.constants'

const FUNDING_INTERVAL_SECONDS = 28800
const INDEX_NOISE_AMPLITUDE = 0.001
const FUNDING_RATE_AMPLITUDE = 0.0005
const FUNDING_RATE_PERIOD_SECONDS = 14400
const OPEN_INTEREST_MULTIPLIER = 1000

function computeFundingRate(nowSeconds: number): number {
  const phase = (2 * Math.PI * nowSeconds) / FUNDING_RATE_PERIOD_SECONDS
  return FUNDING_RATE_AMPLITUDE * Math.sin(phase)
}

function computeFundingCountdownSeconds(nowSeconds: number): number {
  return FUNDING_INTERVAL_SECONDS - (nowSeconds % FUNDING_INTERVAL_SECONDS)
}

function computeIndexPrice(markPrice: number, seed: number, time: number): number {
  const noiseSeed = (seed ^ 0xdeadbeef ^ ((time / 100) | 0)) >>> 0
  let state = noiseSeed
  state = (state + 0x6d2b79f5) | 0
  let z = state
  z = Math.imul(z ^ (z >>> 15), z | 1)
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
  const uniform = ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  const noise = (uniform - 0.5) * 2 * INDEX_NOISE_AMPLITUDE
  return markPrice * (1 + noise)
}

function computeOpen24h(symbol: string, seed: number, time: number): number {
  const openTime = time - 86400000
  return computePrice(symbol, seed ^ 0xcafebabe, openTime)
}

function computeHigh24h(markPrice: number, open24h: number, seed: number, time: number): number {
  const highSeed = (seed ^ 0x12345678 ^ ((time / 200) | 0)) >>> 0
  let state = highSeed
  state = (state + 0x6d2b79f5) | 0
  const uniform = (state >>> 0) / 0x100000000
  const highOffset = uniform * 0.02 + 0.005
  return Math.max(markPrice, open24h) * (1 + highOffset)
}

function computeLow24h(markPrice: number, open24h: number, seed: number, time: number): number {
  const lowSeed = (seed ^ 0x87654321 ^ ((time / 300) | 0)) >>> 0
  let state = lowSeed
  state = (state + 0x6d2b79f5) | 0
  const uniform = (state >>> 0) / 0x100000000
  const lowOffset = uniform * 0.02 + 0.005
  return Math.min(markPrice, open24h) * (1 - lowOffset)
}

function computeOpenInterest(symbol: string, nowSeconds: number): number {
  const anchor = ANCHOR_PRICES[symbol] ?? 1000
  const phase = (2 * Math.PI * nowSeconds) / 3600
  return anchor * OPEN_INTEREST_MULTIPLIER * (1 + 0.1 * Math.sin(phase))
}

export function computeTicker(symbol: string, seed: number, time: number): PerpTicker {
  const markPrice = computePrice(symbol, seed, time)
  const indexPrice = computeIndexPrice(markPrice, seed, time)
  const nowSeconds = Math.floor(time / 1000)
  const fundingRate = computeFundingRate(nowSeconds)
  const fundingCountdownSeconds = computeFundingCountdownSeconds(nowSeconds)
  const open24h = computeOpen24h(symbol, seed, time)
  const high24h = computeHigh24h(markPrice, open24h, seed, time)
  const low24h = computeLow24h(markPrice, open24h, seed, time)
  const openInterest = computeOpenInterest(symbol, nowSeconds)

  return {
    symbol,
    // mock-venue markets are perps → PerpTicker variant (ADR-0013 backward-compat).
    marketType: 'perp',
    markPrice,
    indexPrice,
    open24h,
    high24h,
    low24h,
    fundingRate,
    fundingCountdownSeconds,
    openInterest,
    timestamp: time,
  }
}
