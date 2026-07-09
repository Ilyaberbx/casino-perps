import { describe, it, expect } from 'vitest'
import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'
import {
  buildPositionTpslLegs,
  positionReferenceSide,
  projectPositionTpslOrders,
} from '../position-tpsl.utils'
import type { PositionTpslLegState } from '../position-tpsl.types'

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 2,
    entryPrice: 60_000,
    markPrice: 61_000,
    positionValueUsd: 122_000,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: null,
    marginUsedUsd: 0,
    ...overrides,
  }
}

function leg(overrides: Partial<PositionTpslLegState> = {}): PositionTpslLegState {
  return {
    draft: { priceInput: '', amountInput: '' },
    basis: 'usd',
    ...overrides,
  }
}

const EMPTY_LEG = leg()

describe('positionReferenceSide', () => {
  it('maps long → buy and short → sell', () => {
    expect(positionReferenceSide('long')).toBe('buy')
    expect(positionReferenceSide('short')).toBe('sell')
  })
})

describe('buildPositionTpslLegs', () => {
  it('returns null when neither leg is populated', () => {
    expect(
      buildPositionTpslLegs({
        position: position(),
        takeProfit: EMPTY_LEG,
        stopLoss: EMPTY_LEG,
        size: undefined,
        limitPrice: undefined,
      }),
    ).toBeNull()
  })

  it('builds a price TP leg', () => {
    const legs = buildPositionTpslLegs({
      position: position(),
      takeProfit: leg({ draft: { priceInput: '70000', amountInput: '' } }),
      stopLoss: EMPTY_LEG,
      size: undefined,
      limitPrice: undefined,
    })
    expect(legs).toEqual({
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
  })

  it('derives a percent SL into an absolute trigger price (long below entry)', () => {
    const legs = buildPositionTpslLegs({
      position: position(),
      takeProfit: EMPTY_LEG,
      stopLoss: leg({ basis: 'percent', draft: { priceInput: '', amountInput: '10' } }),
      size: undefined,
      limitPrice: undefined,
    })
    // 60_000 × (1 − 0.10) = 54_000
    expect(legs?.stopLoss).toEqual({ kind: 'stop-loss', trigger: { type: 'price', price: 54_000 } })
  })

  it('attaches size and limitPrice to every built leg when set', () => {
    const legs = buildPositionTpslLegs({
      position: position(),
      takeProfit: leg({ draft: { priceInput: '70000', amountInput: '' } }),
      stopLoss: leg({ draft: { priceInput: '55000', amountInput: '' } }),
      size: 0.5,
      limitPrice: 69_500,
    })
    expect(legs?.takeProfit).toMatchObject({ size: 0.5, limitPrice: 69_500 })
    expect(legs?.stopLoss).toMatchObject({ size: 0.5, limitPrice: 69_500 })
  })

  it('omits size/limitPrice when unset (full-size trigger-market)', () => {
    const legs = buildPositionTpslLegs({
      position: position(),
      takeProfit: leg({ draft: { priceInput: '70000', amountInput: '' } }),
      stopLoss: EMPTY_LEG,
      size: undefined,
      limitPrice: undefined,
    })
    expect(legs?.takeProfit).not.toHaveProperty('size')
    expect(legs?.takeProfit).not.toHaveProperty('limitPrice')
  })
})

function order(overrides: Partial<Order> = {}): Order {
  return {
    identifier: '1',
    symbol: 'BTC-PERP',
    side: 'sell',
    size: 2,
    price: 70_000,
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

describe('projectPositionTpslOrders', () => {
  it('projects a TP order with positive expected PnL for a long', () => {
    const rows = projectPositionTpslOrders([order({ triggerKind: 'tp', triggerPrice: 70_000 })], position())
    expect(rows).toHaveLength(1)
    expect(rows[0].typeLabel).toBe('Take Profit')
    expect(rows[0].triggerPrice).toBe(70_000)
    // (70_000 − 60_000) × 2 × (+1 for long) = 20_000
    expect(rows[0].expectedPnlUsd).toBeCloseTo(20_000, 4)
  })

  it('projects an SL order with negative expected PnL for a long', () => {
    const rows = projectPositionTpslOrders([order({ triggerKind: 'sl', triggerPrice: 55_000 })], position())
    expect(rows[0].typeLabel).toBe('Stop Loss')
    // (55_000 − 60_000) × 2 × (+1) = −10_000
    expect(rows[0].expectedPnlUsd).toBeCloseTo(-10_000, 4)
  })

  it('flips the PnL sign for a short position', () => {
    const rows = projectPositionTpslOrders(
      [order({ triggerKind: 'tp', triggerPrice: 50_000 })],
      position({ side: 'short', size: -2, entryPrice: 60_000 }),
    )
    // (50_000 − 60_000) × |2| × (−1 for short) = +20_000
    expect(rows[0].expectedPnlUsd).toBeCloseTo(20_000, 4)
  })

  it('ignores orders for a different symbol', () => {
    const rows = projectPositionTpslOrders([order({ symbol: 'ETH-PERP' })], position({ symbol: 'BTC-PERP' }))
    expect(rows).toHaveLength(0)
  })

  it('ignores non-reduce-only / non-trigger orders', () => {
    const rows = projectPositionTpslOrders(
      [order({ reduceOnly: false }), order({ identifier: '2', triggerPrice: undefined })],
      position(),
    )
    expect(rows).toHaveLength(0)
  })
})
