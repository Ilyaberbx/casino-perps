import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'
import { usePositionTpsl } from '../use-position-tpsl'

const POSITION: PerpPositionSnapshot = {
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
}

function restingOrder(overrides: Partial<Order> = {}): Order {
  return {
    identifier: 'oid-1',
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

function setup(restingOrders: ReadonlyArray<Order> = []) {
  const onSubmit = vi.fn()
  const onCancelOrder = vi.fn()
  const onClose = vi.fn()
  const view = renderHook(() =>
    usePositionTpsl({ position: POSITION, restingOrders, onSubmit, onCancelOrder, onClose }),
  )
  return { view, onSubmit, onCancelOrder, onClose }
}

describe('usePositionTpsl', () => {
  it('starts on the Create tab and switches to Orders', () => {
    const { view } = setup()
    expect(view.result.current.activeTab).toBe('create')
    act(() => view.result.current.setActiveTab('orders'))
    expect(view.result.current.activeTab).toBe('orders')
  })

  it('couples a typed TP price into a derived $ gain', () => {
    const { view } = setup()
    act(() => view.result.current.setLegPrice('takeProfit', '63000'))
    // |63_000 − 60_000| × size 2 = 6000
    expect(view.result.current.takeProfit.draft.priceInput).toBe('63000')
    expect(view.result.current.takeProfit.draft.amountInput).toBe('6000')
  })

  it('couples a typed gain into a derived price', () => {
    const { view } = setup()
    act(() => view.result.current.setLegAmount('takeProfit', '6000'))
    expect(view.result.current.takeProfit.draft.amountInput).toBe('6000')
    expect(Number(view.result.current.takeProfit.draft.priceInput)).toBeCloseTo(63_000, 5)
  })

  it('reprojects a leg gain when its basis toggles', () => {
    const { view } = setup()
    act(() => view.result.current.setLegPrice('takeProfit', '66000'))
    act(() => view.result.current.setLegBasis('takeProfit', 'percent'))
    expect(view.result.current.takeProfit.basis).toBe('percent')
    // price held at 66_000 → 10% off 60_000
    expect(view.result.current.takeProfit.draft.amountInput).toBe('10')
  })

  it('MAX sets the amount to the full position size and fraction to 1', () => {
    const { view } = setup()
    act(() => view.result.current.setConfigureAmount(true))
    act(() => view.result.current.setAmountToMax())
    expect(view.result.current.amountInput).toBe('2')
    expect(view.result.current.amountFraction).toBeCloseTo(1, 5)
  })

  it('the slider fraction sets the amount as a fraction of position size', () => {
    const { view } = setup()
    act(() => view.result.current.setConfigureAmount(true))
    act(() => view.result.current.setAmountFraction(0.5))
    expect(Number(view.result.current.amountInput)).toBeCloseTo(1, 5)
  })

  it('submits a TP leg with no size/limit by default (full-size trigger-market)', () => {
    const { view, onSubmit, onClose } = setup()
    act(() => view.result.current.setLegPrice('takeProfit', '70000'))
    expect(view.result.current.canSubmit).toBe(true)
    act(() => view.result.current.submit())
    expect(onSubmit).toHaveBeenCalledWith('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('submits with size when Configure Amount is on', () => {
    const { view, onSubmit } = setup()
    act(() => view.result.current.setLegPrice('takeProfit', '70000'))
    act(() => view.result.current.setConfigureAmount(true))
    act(() => view.result.current.setAmountInput('1'))
    act(() => view.result.current.submit())
    expect(onSubmit).toHaveBeenCalledWith('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 }, size: 1 },
    })
  })

  it('submits with limitPrice when Limit Price is on', () => {
    const { view, onSubmit } = setup()
    act(() => view.result.current.setLegPrice('takeProfit', '70000'))
    act(() => view.result.current.setLimitPriceEnabled(true))
    act(() => view.result.current.setLimitPriceInput('69500'))
    act(() => view.result.current.submit())
    expect(onSubmit).toHaveBeenCalledWith('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 }, limitPrice: 69_500 },
    })
  })

  it('cannot submit when neither leg is populated', () => {
    const { view } = setup()
    expect(view.result.current.canSubmit).toBe(false)
  })

  it('lists resting TP/SL orders on the Orders tab', () => {
    const { view } = setup([restingOrder({ triggerKind: 'tp', triggerPrice: 70_000 })])
    expect(view.result.current.orderRows).toHaveLength(1)
    expect(view.result.current.orderRows[0].typeLabel).toBe('Take Profit')
  })

  it('cancels a resting order through onCancelOrder', () => {
    const { view, onCancelOrder } = setup([restingOrder({ identifier: 'oid-9' })])
    act(() => view.result.current.cancelOrder('oid-9'))
    expect(onCancelOrder).toHaveBeenCalledWith('oid-9')
  })
})
