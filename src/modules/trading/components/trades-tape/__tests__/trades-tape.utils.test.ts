import { describe, it, expect } from 'vitest'
import type { Trade } from '../../../../shared/domain/domain.types'
import { tradesHaveParticipants } from '../trades-tape.utils'

const TAKER = '0x1111111111111111111111111111111111111111'

function buildTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    identifier: 'trade-1',
    symbol: 'BTC-PERP',
    side: 'buy',
    price: 65000,
    size: 0.5,
    timestamp: 1_000_000,
    ...overrides,
  }
}

describe('tradesHaveParticipants', () => {
  it('is false when no buffered trade carries a participant', () => {
    expect(tradesHaveParticipants([buildTrade(), buildTrade()])).toBe(false)
  })

  it('is true when at least one trade carries a taker or maker', () => {
    const withTaker = buildTrade({ takerAddress: TAKER as Trade['takerAddress'] })
    expect(tradesHaveParticipants([buildTrade(), withTaker])).toBe(true)
  })

  it('is false for an empty buffer', () => {
    expect(tradesHaveParticipants([])).toBe(false)
  })
})
