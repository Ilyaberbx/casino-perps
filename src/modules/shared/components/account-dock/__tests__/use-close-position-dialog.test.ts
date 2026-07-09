import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClosePositionDialog } from '../use-close-position-dialog'
import type { PerpPositionSnapshot } from '@/modules/shared/domain'

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 4,
    entryPrice: 60_000,
    markPrice: 61_000,
    positionValueUsd: 244_000,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: null,
    marginUsedUsd: 0,
    ...overrides,
  }
}

function setup(pos: PerpPositionSnapshot | null = position()) {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const view = renderHook(() =>
    useClosePositionDialog({ position: pos, onSubmit, onClose }),
  )
  return { view, onSubmit, onClose }
}

describe('useClosePositionDialog', () => {
  it('resolves a percent close to a coin size of the position', () => {
    const { view } = setup(position({ size: 4 }))
    act(() => view.result.current.setSizeInput('50'))
    expect(view.result.current.resolvedSize).toBe(2)
    expect(view.result.current.canSubmit).toBe(true)
  })

  it('blocks submit when limit close has no price', () => {
    const { view } = setup()
    act(() => {
      view.result.current.setKind('limit')
      view.result.current.setSizeInput('50')
    })
    expect(view.result.current.isPriceValid).toBe(false)
    expect(view.result.current.canSubmit).toBe(false)
  })

  it('submits a reduce-only market close and closes the dialog', () => {
    const { view, onSubmit, onClose } = setup(position({ size: 4 }))
    act(() => {
      view.result.current.setSizeBasis('coin')
      view.result.current.setSizeInput('1')
    })
    act(() => view.result.current.submit())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'market', reduceOnly: true, side: 'sell', size: 1 }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('submits a reduce-only limit close with the entered price', () => {
    const { view, onSubmit } = setup(position({ size: 4 }))
    act(() => {
      view.result.current.setKind('limit')
      view.result.current.setSizeBasis('coin')
      view.result.current.setSizeInput('2')
      view.result.current.setPriceInput('62000')
    })
    act(() => view.result.current.submit())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'limit', price: 62000, reduceOnly: true, size: 2 }),
    )
  })
})
