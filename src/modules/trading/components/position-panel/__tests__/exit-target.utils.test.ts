import { describe, it, expect } from 'vitest'
import type { PerpPositionSnapshot } from '@/modules/shared/domain'
import {
  isBeyondLiquidation,
  isOnCorrectSide,
  parseTriggerInput,
  roiPctFor,
  validateExitTargets,
} from '../exit-target.utils'

function long(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 1,
    entryPrice: 100,
    markPrice: 100,
    positionValueUsd: 100,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: 91,
    marginUsedUsd: 10,
    ...overrides,
  }
}

const short = (overrides: Partial<PerpPositionSnapshot> = {}) =>
  long({ side: 'short', liquidationPrice: 109, ...overrides })

describe('roiPctFor', () => {
  it('multiplies the price move by leverage — the number a trader actually feels', () => {
    // +2% on a 10x long = +20% on your margin.
    expect(roiPctFor(102, long())).toBeCloseTo(20)
    // -2% on a 10x long = -20%.
    expect(roiPctFor(98, long())).toBeCloseTo(-20)
  })

  it('inverts for a short — it profits as the price falls', () => {
    expect(roiPctFor(98, short())).toBeCloseTo(20)
    expect(roiPctFor(102, short())).toBeCloseTo(-20)
  })

  it('scales with leverage', () => {
    expect(roiPctFor(102, long({ leverage: 25 }))).toBeCloseTo(50)
    expect(roiPctFor(102, long({ leverage: 1 }))).toBeCloseTo(2)
  })

  it('is null when the inputs cannot produce a meaningful number', () => {
    expect(roiPctFor(0, long())).toBeNull()
    expect(roiPctFor(102, long({ entryPrice: 0 }))).toBeNull()
    expect(roiPctFor(102, long({ leverage: 0 }))).toBeNull()
  })
})

describe('isOnCorrectSide', () => {
  it('puts a long take-profit above entry and its stop below', () => {
    expect(isOnCorrectSide('takeProfit', 110, long())).toBe(true)
    expect(isOnCorrectSide('takeProfit', 90, long())).toBe(false)
    expect(isOnCorrectSide('stopLoss', 95, long())).toBe(true)
    expect(isOnCorrectSide('stopLoss', 110, long())).toBe(false)
  })

  it('mirrors for a short', () => {
    expect(isOnCorrectSide('takeProfit', 90, short())).toBe(true)
    expect(isOnCorrectSide('stopLoss', 105, short())).toBe(true)
    expect(isOnCorrectSide('takeProfit', 110, short())).toBe(false)
  })
})

describe('isBeyondLiquidation', () => {
  it('rejects a long stop at or under the liquidation — it would never fire', () => {
    expect(isBeyondLiquidation(91, long())).toBe(true)
    expect(isBeyondLiquidation(90, long())).toBe(true)
    expect(isBeyondLiquidation(95, long())).toBe(false)
  })

  it('mirrors for a short', () => {
    expect(isBeyondLiquidation(109, short())).toBe(true)
    expect(isBeyondLiquidation(105, short())).toBe(false)
  })

  it('is permissive when the venue reports no liquidation price', () => {
    expect(isBeyondLiquidation(50, long({ liquidationPrice: null }))).toBe(false)
  })
})

describe('validateExitTargets', () => {
  it('accepts a well-formed pair', () => {
    expect(validateExitTargets(110, 95, long())).toEqual([])
  })

  it('accepts a single leg', () => {
    expect(validateExitTargets(110, null, long())).toEqual([])
    expect(validateExitTargets(null, 95, long())).toEqual([])
  })

  it('rejects a take-profit on the losing side of entry', () => {
    const issues = validateExitTargets(90, null, long())
    expect(issues).toHaveLength(1)
    expect(issues[0].leg).toBe('takeProfit')
    expect(issues[0].message).toMatch(/above your entry/i)
  })

  it('rejects a stop-loss past the liquidation price — that is not a stop', () => {
    const issues = validateExitTargets(null, 90, long())
    expect(issues).toHaveLength(1)
    expect(issues[0].leg).toBe('stopLoss')
    expect(issues[0].message).toMatch(/liquidated first/i)
  })

  it('reports the wrong-side stop before the liquidation check, not both', () => {
    const issues = validateExitTargets(null, 120, long())
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/below your entry/i)
  })

  it('has no separate "crossed legs" rule, because the side checks make it unreachable', () => {
    // For a long, TP must be above entry and SL below it — so any pair that
    // passes both checks is already ordered TP > entry > SL. A cross rule could
    // only ever duplicate a side error, so there deliberately isn't one.
    expect(validateExitTargets(101, 99, long({ entryPrice: 100 }))).toEqual([])
    const wrongWayRound = validateExitTargets(99, 101, long({ entryPrice: 100 }))
    expect(wrongWayRound.map((issue) => issue.leg)).toEqual(['takeProfit', 'stopLoss'])
  })

  it('nothing to validate when both legs are unset', () => {
    expect(validateExitTargets(null, null, long())).toEqual([])
  })
})

describe('parseTriggerInput', () => {
  it('parses a positive number and rejects everything else', () => {
    expect(parseTriggerInput('102.5')).toBe(102.5)
    expect(parseTriggerInput('')).toBeNull()
    expect(parseTriggerInput('  ')).toBeNull()
    expect(parseTriggerInput('abc')).toBeNull()
    expect(parseTriggerInput('0')).toBeNull()
    expect(parseTriggerInput('-5')).toBeNull()
  })
})
