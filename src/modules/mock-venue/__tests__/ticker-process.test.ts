import { describe, it, expect } from 'vitest'
import { computeTicker } from '../ticker-process'
import { ANCHOR_PRICES } from '../mock-venue.constants'

const SEED = 42
const SYMBOL = 'BTC-PERP'
const ANCHOR = ANCHOR_PRICES[SYMBOL]

describe('computeTicker', () => {
  it('returns the correct symbol', () => {
    const ticker = computeTicker(SYMBOL, SEED, Date.now())
    expect(ticker.symbol).toBe(SYMBOL)
  })

  it('markPrice is anchored near the BTC-PERP anchor price', () => {
    const tolerance = ANCHOR * 0.5
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.markPrice).toBeGreaterThan(ANCHOR - tolerance)
    expect(ticker.markPrice).toBeLessThan(ANCHOR + tolerance)
  })

  it('indexPrice is very close to markPrice (tiny noise)', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    const relativeDifference = Math.abs(ticker.indexPrice - ticker.markPrice) / ticker.markPrice
    expect(relativeDifference).toBeLessThan(0.01)
  })

  it('open24h is anchored near the BTC-PERP anchor price', () => {
    const tolerance = ANCHOR * 0.5
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.open24h).toBeGreaterThan(ANCHOR - tolerance)
    expect(ticker.open24h).toBeLessThan(ANCHOR + tolerance)
  })

  it('high24h is greater than or equal to markPrice', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.high24h).toBeGreaterThanOrEqual(ticker.markPrice)
  })

  it('low24h is less than or equal to markPrice', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.low24h).toBeLessThanOrEqual(ticker.markPrice)
  })

  it('high24h is greater than or equal to open24h', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.high24h).toBeGreaterThanOrEqual(ticker.open24h)
  })

  it('low24h is less than or equal to open24h', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.low24h).toBeLessThanOrEqual(ticker.open24h)
  })

  it('fundingRate is a small number (within ±0.01)', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.fundingRate).toBeGreaterThan(-0.01)
    expect(ticker.fundingRate).toBeLessThan(0.01)
  })

  it('fundingCountdownSeconds is between 0 and 28800 (8 hours)', () => {
    const ticker = computeTicker(SYMBOL, SEED, Date.now())
    expect(ticker.fundingCountdownSeconds).toBeGreaterThanOrEqual(0)
    expect(ticker.fundingCountdownSeconds).toBeLessThan(28800)
  })

  it('is deterministic given same (symbol, seed, time)', () => {
    const tickerA = computeTicker(SYMBOL, SEED, 1000)
    const tickerB = computeTicker(SYMBOL, SEED, 1000)
    expect(tickerA).toEqual(tickerB)
  })

  it('openInterest is a positive number', () => {
    const ticker = computeTicker(SYMBOL, SEED, 0)
    expect(ticker.openInterest).toBeGreaterThan(0)
  })

  it('ETH-PERP is anchored near its anchor price', () => {
    const ethAnchor = ANCHOR_PRICES['ETH-PERP']
    const tolerance = ethAnchor * 0.5
    const ticker = computeTicker('ETH-PERP', SEED, 0)
    expect(ticker.markPrice).toBeGreaterThan(ethAnchor - tolerance)
    expect(ticker.markPrice).toBeLessThan(ethAnchor + tolerance)
  })
})
