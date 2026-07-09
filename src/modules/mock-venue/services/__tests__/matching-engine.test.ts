import { describe, it, expect } from 'vitest'
import {
  matchMarketOrder,
  restLimit,
  cancelLimit,
  tickRestingAgainstMid,
  computeSlippageFraction,
} from '../matching-engine'
import type { RestingLimit, BookSnapshot } from '../../mock-venue.types'

const SAMPLE_BOOK: BookSnapshot = {
  bids: [
    { price: 100, size: 5 },
    { price: 99, size: 5 },
  ],
  asks: [
    { price: 101, size: 5 },
    { price: 102, size: 5 },
  ],
}

describe('matchMarketOrder', () => {
  it('emits exactly one buy fill above mid with size-aware slippage', () => {
    const fill = matchMarketOrder({
      orderIdentifier: 'order-1',
      fillIdentifier: 'fill-1',
      symbol: 'BTC-PERP',
      side: 'buy',
      size: 1,
      book: SAMPLE_BOOK,
      midPrice: 100.5,
      timestamp: 1000,
    })
    const expectedSlippage = computeSlippageFraction(1, 10)
    const expectedPrice = 100.5 * (1 + expectedSlippage)
    expect(fill.identifier).toBe('fill-1')
    expect(fill.orderIdentifier).toBe('order-1')
    expect(fill.size).toBe(1)
    expect(fill.side).toBe('buy')
    expect(fill.price).toBeCloseTo(expectedPrice, 8)
  })

  it('emits a sell fill below mid', () => {
    const fill = matchMarketOrder({
      orderIdentifier: 'order-2',
      fillIdentifier: 'fill-2',
      symbol: 'BTC-PERP',
      side: 'sell',
      size: 1,
      book: SAMPLE_BOOK,
      midPrice: 100.5,
      timestamp: 1000,
    })
    expect(fill.price).toBeLessThan(100.5)
  })

  it('larger size produces larger slippage relative to depth', () => {
    const small = matchMarketOrder({
      orderIdentifier: 'a',
      fillIdentifier: 'fa',
      symbol: 'BTC-PERP',
      side: 'buy',
      size: 1,
      book: SAMPLE_BOOK,
      midPrice: 100,
      timestamp: 1,
    })
    const large = matchMarketOrder({
      orderIdentifier: 'b',
      fillIdentifier: 'fb',
      symbol: 'BTC-PERP',
      side: 'buy',
      size: 5,
      book: SAMPLE_BOOK,
      midPrice: 100,
      timestamp: 1,
    })
    expect(large.price).toBeGreaterThan(small.price)
  })
})

describe('resting limits and cross detection', () => {
  const buyOrder: RestingLimit = {
    identifier: 'limit-buy-1',
    symbol: 'BTC-PERP',
    side: 'buy',
    price: 99,
    size: 1,
    timestamp: 0,
  }
  const sellOrder: RestingLimit = {
    identifier: 'limit-sell-1',
    symbol: 'BTC-PERP',
    side: 'sell',
    price: 101,
    size: 1,
    timestamp: 0,
  }

  it('does not fill while mid stays on same side as buy limit', () => {
    const resting = restLimit([], buyOrder)
    const result = tickRestingAgainstMid(100.5, 100.0, resting, () => 'fill-x', 1)
    expect(result.fills).toHaveLength(0)
    expect(result.remaining).toHaveLength(1)
  })

  it('fills exactly once when mid crosses a buy limit', () => {
    let counter = 0
    const factory = () => `fill-${++counter}`
    const resting = restLimit([], buyOrder)
    const firstTick = tickRestingAgainstMid(100.5, 98.5, resting, factory, 1)
    expect(firstTick.fills).toHaveLength(1)
    expect(firstTick.fills[0].orderIdentifier).toBe('limit-buy-1')
    expect(firstTick.fills[0].price).toBe(99)
    const secondTick = tickRestingAgainstMid(98.5, 97, firstTick.remaining, factory, 2)
    expect(secondTick.fills).toHaveLength(0)
  })

  it('fills exactly once when mid crosses a sell limit upward', () => {
    const resting = restLimit([], sellOrder)
    const result = tickRestingAgainstMid(100, 102, resting, () => 'fill-up', 5)
    expect(result.fills).toHaveLength(1)
    expect(result.fills[0].side).toBe('sell')
  })

  it('cancel removes a resting order so a subsequent cross does not fill it', () => {
    const restingAfterPlace = restLimit([], buyOrder)
    const restingAfterCancel = cancelLimit(restingAfterPlace, 'limit-buy-1')
    expect(restingAfterCancel).toHaveLength(0)
    const result = tickRestingAgainstMid(100.5, 98.5, restingAfterCancel, () => 'fill-x', 1)
    expect(result.fills).toHaveLength(0)
  })

  it('returns no fills when previous mid is unset', () => {
    const resting = restLimit([], buyOrder)
    const result = tickRestingAgainstMid(0, 50, resting, () => 'fill-x', 1)
    expect(result.fills).toHaveLength(0)
    expect(result.remaining).toHaveLength(1)
  })
})
