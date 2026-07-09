import { describe, it, expect } from 'vitest'
import { generateTrade, generateTrades } from '../trade-generator'
import type { OrderbookLevel } from '../../shared/domain'

const FIXED_SEED = 99
const FIXED_TIME = 1_000_000
const FIXED_SYMBOL = 'BTC-PERP'

const SAMPLE_BIDS: OrderbookLevel[] = [
  { price: 64999.5, size: 1.2 },
  { price: 64999.0, size: 2.5 },
]

const SAMPLE_ASKS: OrderbookLevel[] = [
  { price: 65000.0, size: 0.8 },
  { price: 65000.5, size: 1.5 },
]

describe('generateTrade', () => {
  it('returns a trade with deterministic output given a seeded RNG and fixed orderbook snapshot', () => {
    const tradeA = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    const tradeB = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(tradeA.price).toBe(tradeB.price)
    expect(tradeA.size).toBe(tradeB.size)
    expect(tradeA.side).toBe(tradeB.side)
  })

  it('produces a trade price that references a real top-of-book level', () => {
    const validPrices = new Set([
      SAMPLE_BIDS[0].price,
      SAMPLE_BIDS[1].price,
      SAMPLE_ASKS[0].price,
      SAMPLE_ASKS[1].price,
    ])
    const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(validPrices.has(trade.price)).toBe(true)
  })

  it('has a positive size', () => {
    const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(trade.size).toBeGreaterThan(0)
  })

  it('side is either buy or sell', () => {
    const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(['buy', 'sell']).toContain(trade.side)
  })

  it('has the correct symbol', () => {
    const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(trade.symbol).toBe(FIXED_SYMBOL)
  })

  it('has a non-empty identifier', () => {
    const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(trade.identifier.length).toBeGreaterThan(0)
  })
})

describe('generateTrade side weighting', () => {
  it('side weighting reflects recent drift — buy probability skews high when drift is positive', () => {
    const SAMPLE_COUNT = 2000
    const POSITIVE_DRIFT = 0.8
    let buyCount = 0
    for (let index = 0; index < SAMPLE_COUNT; index++) {
      const trade = generateTrade(
        FIXED_SYMBOL,
        SAMPLE_BIDS,
        SAMPLE_ASKS,
        index,
        FIXED_TIME + index,
        POSITIVE_DRIFT,
      )
      if (trade.side === 'buy') {
        buyCount += 1
      }
    }
    const buyProportion = buyCount / SAMPLE_COUNT
    expect(buyProportion).toBeGreaterThan(0.55)
  })

  it('side weighting reflects recent drift — sell probability skews high when drift is negative', () => {
    const SAMPLE_COUNT = 2000
    const NEGATIVE_DRIFT = -0.8
    let sellCount = 0
    for (let index = 0; index < SAMPLE_COUNT; index++) {
      const trade = generateTrade(
        FIXED_SYMBOL,
        SAMPLE_BIDS,
        SAMPLE_ASKS,
        index,
        FIXED_TIME + index,
        NEGATIVE_DRIFT,
      )
      if (trade.side === 'sell') {
        sellCount += 1
      }
    }
    const sellProportion = sellCount / SAMPLE_COUNT
    expect(sellProportion).toBeGreaterThan(0.55)
  })
})

describe('generateTrade taker/maker pool', () => {
  it('assigns a taker and a maker drawn from a small fixed pool', () => {
    const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME)
    expect(trade.takerAddress).toBeDefined()
    expect(trade.makerAddress).toBeDefined()
    expect(trade.takerAddress).toMatch(/^0x[0-9a-f]{40}$/)
    expect(trade.makerAddress).toMatch(/^0x[0-9a-f]{40}$/)
  })

  it('reuses addresses across many trades — the pool repeats rather than being unique per row', () => {
    const SAMPLE_COUNT = 200
    const seenTakers = new Set<string>()
    const seenMakers = new Set<string>()
    for (let index = 0; index < SAMPLE_COUNT; index++) {
      const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, index, FIXED_TIME + index)
      if (trade.takerAddress !== undefined) seenTakers.add(trade.takerAddress)
      if (trade.makerAddress !== undefined) seenMakers.add(trade.makerAddress)
    }
    // A fixed ~6-8 address pool can never produce 200 distinct values.
    expect(seenTakers.size).toBeLessThanOrEqual(8)
    expect(seenMakers.size).toBeLessThanOrEqual(8)
    expect(seenTakers.size).toBeGreaterThan(1)
  })

  it('never assigns the same address to both taker and maker of one trade', () => {
    const SAMPLE_COUNT = 200
    for (let index = 0; index < SAMPLE_COUNT; index++) {
      const trade = generateTrade(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, index, FIXED_TIME + index)
      expect(trade.takerAddress).not.toBe(trade.makerAddress)
    }
  })
})

describe('generateTrades', () => {
  it('returns multiple trade events for a given interval', () => {
    const trades = generateTrades(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME, 3)
    expect(trades.length).toBe(3)
  })

  it('all generated trades have valid prices from the orderbook', () => {
    const validPrices = new Set([
      SAMPLE_BIDS[0].price,
      SAMPLE_BIDS[1].price,
      SAMPLE_ASKS[0].price,
      SAMPLE_ASKS[1].price,
    ])
    const trades = generateTrades(FIXED_SYMBOL, SAMPLE_BIDS, SAMPLE_ASKS, FIXED_SEED, FIXED_TIME, 5)
    for (const trade of trades) {
      expect(validPrices.has(trade.price)).toBe(true)
    }
  })
})
