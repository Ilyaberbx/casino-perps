import { describe, it, expect } from 'vitest'
import { PlaceOrderError } from '@/modules/shared/domain'
import type { PlaceOrderOutcomeBase, TriggerLeg } from '@/modules/shared/domain'
import type {
  HyperliquidOrderStatus,
  OrderSuccessResponse,
  TwapOrderSuccessResponse,
} from '../../gateway'
import {
  applySlippage,
  buildOutcomeBase,
  clampTwapMinutes,
  closingSide,
  deriveMarketReferencePrice,
  isBuySide,
  resolveStopTpsl,
  resolveTriggerPrice,
  triggerTpsl,
  unpackOrderResponse,
  unpackOrderStatus,
  unpackTwapResponse,
} from '../hyperliquid-trader.utils'

describe('isBuySide / closingSide', () => {
  it('maps buy → true, sell → false', () => {
    expect(isBuySide('buy')).toBe(true)
    expect(isBuySide('sell')).toBe(false)
  })
  it('closingSide is the opposite of the entry side', () => {
    expect(closingSide('buy')).toBe('sell')
    expect(closingSide('sell')).toBe('buy')
  })
})

describe('deriveMarketReferencePrice', () => {
  it('uses topAsk for a buy and topBid for a sell', () => {
    const ref = { topBid: 99, topAsk: 101, mark: 100 }
    expect(deriveMarketReferencePrice('buy', ref)).toBe(101)
    expect(deriveMarketReferencePrice('sell', ref)).toBe(99)
  })
  it('falls back to mark when the relevant side is missing', () => {
    expect(deriveMarketReferencePrice('buy', { mark: 100 })).toBe(100)
    expect(deriveMarketReferencePrice('sell', { topAsk: 101, mark: 100 })).toBe(100)
  })
  it('returns null when neither a side price nor mark is positive', () => {
    expect(deriveMarketReferencePrice('buy', {})).toBeNull()
    expect(deriveMarketReferencePrice('buy', { topAsk: 0, mark: 0 })).toBeNull()
  })
})

describe('applySlippage', () => {
  it('pays up for a buy and receives down for a sell', () => {
    expect(applySlippage(100, 'buy', 0.05)).toBeCloseTo(105)
    expect(applySlippage(100, 'sell', 0.05)).toBeCloseTo(95)
  })
})

describe('resolveTriggerPrice', () => {
  it('passes an absolute price trigger through unchanged', () => {
    const leg: TriggerLeg = { kind: 'take-profit', trigger: { type: 'price', price: 110 } }
    expect(resolveTriggerPrice(leg, 100, 'buy')).toBe(110)
  })
  it('take-profit for a long resolves above the reference', () => {
    const leg: TriggerLeg = { kind: 'take-profit', trigger: { type: 'percent', percent: 10 } }
    expect(resolveTriggerPrice(leg, 100, 'buy')).toBeCloseTo(110)
  })
  it('stop-loss for a long resolves below the reference', () => {
    const leg: TriggerLeg = { kind: 'stop-loss', trigger: { type: 'percent', percent: 10 } }
    expect(resolveTriggerPrice(leg, 100, 'buy')).toBeCloseTo(90)
  })
  it('take-profit for a short resolves below the reference', () => {
    const leg: TriggerLeg = { kind: 'take-profit', trigger: { type: 'percent', percent: 10 } }
    expect(resolveTriggerPrice(leg, 100, 'sell')).toBeCloseTo(90)
  })
  it('stop-loss for a short resolves above the reference', () => {
    const leg: TriggerLeg = { kind: 'stop-loss', trigger: { type: 'percent', percent: 10 } }
    expect(resolveTriggerPrice(leg, 100, 'sell')).toBeCloseTo(110)
  })
})

describe('triggerTpsl', () => {
  it('maps the leg kind to the HL tpsl literal', () => {
    expect(triggerTpsl({ kind: 'take-profit', trigger: { type: 'price', price: 1 } })).toBe('tp')
    expect(triggerTpsl({ kind: 'stop-loss', trigger: { type: 'price', price: 1 } })).toBe('sl')
  })
})

const BASE: PlaceOrderOutcomeBase = {
  orderIdentifier: '',
  clientOrderId: '0xabc',
  symbol: 'BTC-PERP',
  timestamp: 1_700_000_000_000,
}

describe('unpackOrderStatus', () => {
  it('maps resting → resting outcome with the oid', () => {
    const status: HyperliquidOrderStatus = { resting: { oid: 12 } }
    const out = unpackOrderStatus(status, BASE)
    expect(out).not.toBeInstanceOf(PlaceOrderError)
    if (!(out instanceof PlaceOrderError)) {
      expect(out.kind).toBe('resting')
      expect(out.orderIdentifier).toBe('12')
    }
  })
  it('maps filled → filled outcome with numeric avgPx/totalSz', () => {
    const status: HyperliquidOrderStatus = { filled: { oid: 9, totalSz: '2.5', avgPx: '101.5' } }
    const out = unpackOrderStatus(status, BASE)
    if (!(out instanceof PlaceOrderError) && out.kind === 'filled') {
      expect(out.filledSize).toBe(2.5)
      expect(out.averagePrice).toBe(101.5)
      expect(out.orderIdentifier).toBe('9')
    }
  })
  it('maps a per-order error to a rejected PlaceOrderError (raw message)', () => {
    const status = { error: 'Post only order would have immediately matched' } as HyperliquidOrderStatus
    const out = unpackOrderStatus(status, BASE)
    expect(out).toBeInstanceOf(PlaceOrderError)
    if (out instanceof PlaceOrderError) {
      expect(out.kind).toBe('rejected')
      expect(out.message).toBe('Post only order would have immediately matched')
    }
  })
  it('maps the string statuses (waitingForFill/Trigger) to resting', () => {
    const out = unpackOrderStatus('waitingForFill' as HyperliquidOrderStatus, BASE)
    if (!(out instanceof PlaceOrderError)) expect(out.kind).toBe('resting')
  })
})

describe('unpackOrderResponse', () => {
  it('unpacks the primary (first) status', () => {
    const response: OrderSuccessResponse = {
      status: 'ok',
      response: { type: 'order', data: { statuses: [{ resting: { oid: 1 } }] } },
    }
    const out = unpackOrderResponse(response, BASE)
    if (!(out instanceof PlaceOrderError)) expect(out.kind).toBe('resting')
  })
  it('rejects when the statuses array is empty', () => {
    const response = {
      status: 'ok',
      response: { type: 'order', data: { statuses: [] } },
    } as OrderSuccessResponse
    const out = unpackOrderResponse(response, BASE)
    expect(out).toBeInstanceOf(PlaceOrderError)
  })
})

describe('buildOutcomeBase', () => {
  it('threads the cloid and symbol through', () => {
    const base = buildOutcomeBase('ETH-PERP', '0xdef', 42)
    expect(base).toEqual({ orderIdentifier: '', clientOrderId: '0xdef', symbol: 'ETH-PERP', timestamp: 42 })
  })
})

describe('resolveStopTpsl', () => {
  it('buy stop above mark is a favourable breakout ⇒ tp', () => {
    expect(resolveStopTpsl('buy', 105_000, 100_000)).toBe('tp')
  })
  it('buy stop below mark is adverse ⇒ sl', () => {
    expect(resolveStopTpsl('buy', 95_000, 100_000)).toBe('sl')
  })
  it('sell stop below mark is a favourable breakdown ⇒ tp', () => {
    expect(resolveStopTpsl('sell', 95_000, 100_000)).toBe('tp')
  })
  it('sell stop above mark is adverse ⇒ sl', () => {
    expect(resolveStopTpsl('sell', 105_000, 100_000)).toBe('sl')
  })
  it('defaults to sl when no reference mark is available', () => {
    expect(resolveStopTpsl('buy', 105_000, null)).toBe('sl')
  })
})

describe('clampTwapMinutes', () => {
  it('passes an in-range integer through', () => {
    expect(clampTwapMinutes(30, 5, 1440)).toBe(30)
  })
  it('raises a below-floor value to the minimum', () => {
    expect(clampTwapMinutes(1, 5, 1440)).toBe(5)
  })
  it('lowers an above-ceiling value to the maximum', () => {
    expect(clampTwapMinutes(5000, 5, 1440)).toBe(1440)
  })
  it('floors a fractional duration to an integer minute', () => {
    expect(clampTwapMinutes(30.9, 5, 1440)).toBe(30)
  })
})

describe('unpackTwapResponse', () => {
  const BASE: PlaceOrderOutcomeBase = { orderIdentifier: '', clientOrderId: '0xabc', symbol: 'BTC-PERP', timestamp: 7 }
  it('maps a running twap to a resting outcome carrying the twapId', () => {
    const response = {
      status: 'ok',
      response: { type: 'twapOrder', data: { status: { running: { twapId: 99 } } } },
    } as TwapOrderSuccessResponse
    const out = unpackTwapResponse(response, BASE)
    if (out instanceof PlaceOrderError) throw new Error('expected an outcome')
    expect(out.kind).toBe('resting')
    expect(out.orderIdentifier).toBe('99')
    expect(out.clientOrderId).toBe('0xabc')
  })
  it('maps a per-twap error under status:"ok" to a rejected PlaceOrderError', () => {
    const response = {
      status: 'ok',
      response: { type: 'twapOrder', data: { status: { error: 'TWAP too small' } } },
    } as unknown as TwapOrderSuccessResponse
    const out = unpackTwapResponse(response, BASE)
    expect(out).toBeInstanceOf(PlaceOrderError)
    if (out instanceof PlaceOrderError) expect(out.message).toBe('TWAP too small')
  })
})
