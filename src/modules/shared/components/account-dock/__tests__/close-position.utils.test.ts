import { describe, it, expect } from 'vitest'
import {
  buildLimitCloseRequest,
  buildMarketCloseRequest,
  clampCloseSize,
  closeSizeForFraction,
  closingSide,
} from '../close-position.utils'
import type { PerpPositionSnapshot } from '@/modules/shared/domain'

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 2,
    entryPrice: 60_000,
    markPrice: 61_000,
    positionValueUsd: 122_000,
    unrealizedPnlUsd: 2_000,
    roePct: 3,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: 55_000,
    marginUsedUsd: 12_200,
    ...overrides,
  }
}

describe('closingSide', () => {
  it('is sell for a long and buy for a short', () => {
    expect(closingSide(position({ side: 'long' }))).toBe('sell')
    expect(closingSide(position({ side: 'short' }))).toBe('buy')
  })
})

describe('clampCloseSize', () => {
  it('clamps to the open size', () => {
    expect(clampCloseSize(5, 2)).toBe(2)
  })

  it('collapses non-positive requests to 0', () => {
    expect(clampCloseSize(0, 2)).toBe(0)
    expect(clampCloseSize(-1, 2)).toBe(0)
  })
})

describe('closeSizeForFraction', () => {
  it('returns the fraction of the open size', () => {
    expect(closeSizeForFraction(0.5, 2)).toBe(1)
  })

  it('caps the fraction at 1', () => {
    expect(closeSizeForFraction(2, 2)).toBe(2)
  })
})

describe('buildMarketCloseRequest', () => {
  it('builds a reduce-only opposite-side market order', () => {
    const request = buildMarketCloseRequest({
      position: position({ side: 'long' }),
      size: 1,
      clientOrderId: '0xabc',
    })
    expect(request).toMatchObject({
      orderType: 'market',
      symbol: 'BTC-PERP',
      side: 'sell',
      size: 1,
      reduceOnly: true,
      clientOrderId: '0xabc',
    })
  })
})

describe('buildLimitCloseRequest', () => {
  it('builds a reduce-only Gtc limit close', () => {
    const request = buildLimitCloseRequest({
      position: position({ side: 'short' }),
      size: 1,
      price: 59_000,
      clientOrderId: '0xabc',
    })
    expect(request).toMatchObject({
      orderType: 'limit',
      side: 'buy',
      price: 59_000,
      timeInForce: 'Gtc',
      reduceOnly: true,
    })
  })
})

// A HIP-3 position carries the RAW namespaced HL coin (`dex:ASSET`) as its
// `symbol` (the perps snapshot reader keeps `position.coin` raw). The close
// builders must forward that symbol verbatim — no main-dex strip — so the
// trader can resolve the HIP-3-encoded asset id downstream. These lock that the
// close request stays symbol-agnostic; the end-to-end asset-id resolution is
// proven in the venue test (`create-hyperliquid-venue.test.ts`).
describe('close builders carry a HIP-3 namespaced symbol verbatim', () => {
  it('market close forwards `xyz:NVDA` unchanged (reduce-only, opposite side)', () => {
    const request = buildMarketCloseRequest({
      position: position({ symbol: 'xyz:NVDA', side: 'long' }),
      size: 0.5,
      clientOrderId: '0xabc',
    })
    expect(request).toMatchObject({
      orderType: 'market',
      symbol: 'xyz:NVDA',
      side: 'sell',
      reduceOnly: true,
    })
  })

  it('limit close forwards `xyz:NVDA` unchanged (reduce-only Gtc, opposite side)', () => {
    const request = buildLimitCloseRequest({
      position: position({ symbol: 'xyz:NVDA', side: 'short' }),
      size: 0.5,
      price: 120,
      clientOrderId: '0xabc',
    })
    expect(request).toMatchObject({
      orderType: 'limit',
      symbol: 'xyz:NVDA',
      side: 'buy',
      timeInForce: 'Gtc',
      reduceOnly: true,
    })
  })
})
