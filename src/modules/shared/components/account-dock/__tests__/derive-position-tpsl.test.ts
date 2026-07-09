import { describe, it, expect } from 'vitest'
import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'
import { derivePositionTpsl } from '../account-dock.utils'

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC',
    side: 'long',
    size: 1,
    entryPrice: 60_000,
    markPrice: 61_000,
    positionValueUsd: 61_000,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: null,
    marginUsedUsd: 0,
    ...overrides,
  }
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    identifier: '1',
    symbol: 'BTC',
    side: 'sell',
    size: 1,
    price: 0,
    filledSize: 0,
    status: 'open',
    orderType: 'market',
    timestamp: 0,
    reduceOnly: true,
    isPositionTpsl: true,
    triggerPrice: 70_000,
    triggerKind: 'tp',
    ...overrides,
  }
}

describe('derivePositionTpsl', () => {
  it('returns the TP trigger price when a TP leg rests on the position', () => {
    const result = derivePositionTpsl([order({ triggerKind: 'tp', triggerPrice: 70_000 })], position())
    expect(result.tpPrice).toBeCloseTo(70_000, 4)
    expect(result.slPrice).toBeUndefined()
  })

  it('returns the SL trigger price when an SL leg rests on the position', () => {
    const result = derivePositionTpsl([order({ triggerKind: 'sl', triggerPrice: 55_000 })], position())
    expect(result.slPrice).toBeCloseTo(55_000, 4)
    expect(result.tpPrice).toBeUndefined()
  })

  it('returns both TP and SL when both legs rest on the position', () => {
    const result = derivePositionTpsl(
      [
        order({ identifier: '1', triggerKind: 'tp', triggerPrice: 70_000 }),
        order({ identifier: '2', triggerKind: 'sl', triggerPrice: 55_000 }),
      ],
      position(),
    )
    expect(result.tpPrice).toBeCloseTo(70_000, 4)
    expect(result.slPrice).toBeCloseTo(55_000, 4)
  })

  it('returns neither when there are no protection orders', () => {
    const result = derivePositionTpsl([], position())
    expect(result.tpPrice).toBeUndefined()
    expect(result.slPrice).toBeUndefined()
  })

  it('ignores orders for a different symbol', () => {
    const result = derivePositionTpsl(
      [order({ symbol: 'ETH', triggerKind: 'tp', triggerPrice: 4000 })],
      position({ symbol: 'BTC' }),
    )
    expect(result.tpPrice).toBeUndefined()
    expect(result.slPrice).toBeUndefined()
  })

  it('ignores non-reduce-only orders', () => {
    const result = derivePositionTpsl(
      [order({ reduceOnly: false, triggerKind: 'tp', triggerPrice: 70_000 })],
      position(),
    )
    expect(result.tpPrice).toBeUndefined()
  })

  it('ignores orders with no trigger price', () => {
    const result = derivePositionTpsl(
      [order({ triggerKind: 'tp', triggerPrice: undefined })],
      position(),
    )
    expect(result.tpPrice).toBeUndefined()
  })

  it('falls back to entry-relative side classification when triggerKind is absent (long)', () => {
    // Long position: a reduce-only trigger above entry is TP, below entry is SL.
    const result = derivePositionTpsl(
      [
        order({ identifier: '1', triggerKind: undefined, triggerPrice: 70_000 }),
        order({ identifier: '2', triggerKind: undefined, triggerPrice: 55_000 }),
      ],
      position({ side: 'long', entryPrice: 60_000 }),
    )
    expect(result.tpPrice).toBeCloseTo(70_000, 4)
    expect(result.slPrice).toBeCloseTo(55_000, 4)
  })

  it('falls back to entry-relative side classification when triggerKind is absent (short)', () => {
    // Short position: a reduce-only trigger below entry is TP, above entry is SL.
    const result = derivePositionTpsl(
      [
        order({ identifier: '1', triggerKind: undefined, triggerPrice: 50_000 }),
        order({ identifier: '2', triggerKind: undefined, triggerPrice: 65_000 }),
      ],
      position({ side: 'short', entryPrice: 60_000 }),
    )
    expect(result.tpPrice).toBeCloseTo(50_000, 4)
    expect(result.slPrice).toBeCloseTo(65_000, 4)
  })

  it('prefers triggerKind over the entry-relative fallback', () => {
    // triggerKind says SL even though the price sits above entry for a long.
    const result = derivePositionTpsl(
      [order({ triggerKind: 'sl', triggerPrice: 70_000 })],
      position({ side: 'long', entryPrice: 60_000 }),
    )
    expect(result.slPrice).toBeCloseTo(70_000, 4)
    expect(result.tpPrice).toBeUndefined()
  })

  it('keeps the most recent leg when multiple TP orders rest on the position', () => {
    const result = derivePositionTpsl(
      [
        order({ identifier: '1', triggerKind: 'tp', triggerPrice: 70_000, timestamp: 1000 }),
        order({ identifier: '2', triggerKind: 'tp', triggerPrice: 72_000, timestamp: 2000 }),
      ],
      position(),
    )
    expect(result.tpPrice).toBeCloseTo(72_000, 4)
  })
})
