import { describe, it, expect } from 'vitest'
import type { Market, Order } from '@/modules/shared/domain'
import {
  liquidationPriceText,
  positionOrderKind,
  positionOrderPrice,
  remainingSize,
} from '../position-panel.utils'

const MARKET: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'mock',
  tickSize: 0.5,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    identifier: 'o1',
    symbol: 'BTC-PERP',
    side: 'sell',
    size: 1,
    price: 70_000,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1,
    ...overrides,
  }
}

describe('positionOrderKind', () => {
  it('names a take-profit and a stop-loss from the venue tagging', () => {
    expect(positionOrderKind(makeOrder({ triggerKind: 'tp' }))).toBe('take-profit')
    expect(positionOrderKind(makeOrder({ triggerKind: 'sl' }))).toBe('stop-loss')
  })

  it('falls back to a plain limit when the venue reports no trigger kind', () => {
    expect(positionOrderKind(makeOrder())).toBe('limit')
  })
})

describe('positionOrderPrice', () => {
  it('shows the trigger price for a trigger order — that is when it fires', () => {
    expect(positionOrderPrice(makeOrder({ triggerPrice: 65_000, price: 0 }))).toBe(65_000)
  })

  it('shows the limit price for a resting limit', () => {
    expect(positionOrderPrice(makeOrder({ price: 70_000 }))).toBe(70_000)
  })
})

describe('remainingSize', () => {
  it('is the unfilled remainder — what a cancel would actually pull', () => {
    expect(remainingSize(makeOrder({ size: 1, filledSize: 0.25 }))).toBe(0.75)
  })

  it('never goes negative on an over-filled order', () => {
    expect(remainingSize(makeOrder({ size: 1, filledSize: 1.5 }))).toBe(0)
  })
})

describe('liquidationPriceText', () => {
  it('formats with the market precision', () => {
    expect(liquidationPriceText(94_102, MARKET)).toBe('94,102')
  })

  it('returns null when the venue reports no (or a non-positive) liquidation', () => {
    expect(liquidationPriceText(null, MARKET)).toBeNull()
    expect(liquidationPriceText(0, MARKET)).toBeNull()
  })
})
