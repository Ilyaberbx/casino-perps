import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useModifyOrderDialog } from '../use-modify-order-dialog'
import type { Order } from '@/modules/shared/domain'

const ORDER: Order = {
  identifier: 'order-1',
  symbol: 'BTC-PERP',
  side: 'buy',
  price: 50_000,
  size: 1,
  filledSize: 0,
  status: 'open',
  orderType: 'limit',
  timestamp: 1,
  originalSize: 1,
}

function setup() {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const view = renderHook(() => useModifyOrderDialog({ order: ORDER, onSubmit, onClose }))
  return { view, onSubmit, onClose }
}

describe('useModifyOrderDialog', () => {
  it('prefills price and size from the resting order', () => {
    const { view } = setup()
    expect(view.result.current.priceInput).toBe('50000')
    expect(view.result.current.sizeInput).toBe('1')
  })

  it('cannot submit when nothing changed', () => {
    const { view } = setup()
    expect(view.result.current.canSubmit).toBe(false)
  })

  it('submits the changed price/size and closes', () => {
    const { view, onSubmit, onClose } = setup()
    act(() => view.result.current.setPriceInput('51000'))
    expect(view.result.current.canSubmit).toBe(true)
    act(() => view.result.current.submit())
    expect(onSubmit).toHaveBeenCalledWith(
      { identifier: 'order-1', price: 51000, size: 1 },
      'BTC-PERP',
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('blocks submit on a non-positive field', () => {
    const { view } = setup()
    act(() => view.result.current.setPriceInput('0'))
    expect(view.result.current.canSubmit).toBe(false)
  })
})
