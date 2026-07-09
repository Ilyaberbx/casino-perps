import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLeverageSlider } from '../use-leverage-slider'

function setup(leverage = 5, maxLeverage = 20) {
  const onApplyLeverage = vi.fn()
  const view = renderHook(
    (props: { leverage: number }) =>
      useLeverageSlider({
        leverage: props.leverage,
        maxLeverage,
        onApplyLeverage,
      }),
    { initialProps: { leverage } },
  )
  return { view, onApplyLeverage }
}

describe('useLeverageSlider', () => {
  it('seeds the draft from the current leverage', () => {
    const { view } = setup(5, 20)
    expect(view.result.current.draftInput).toBe('5')
    expect(view.result.current.draftLeverage).toBe(5)
  })

  it('clamps the draft leverage to the ceiling for the slider', () => {
    const { view } = setup(5, 20)
    act(() => view.result.current.setDraftInput('999'))
    expect(view.result.current.draftLeverage).toBe(20)
  })

  it('commits the clamped leverage on commitLeverage', () => {
    const { view, onApplyLeverage } = setup(5, 20)
    act(() => view.result.current.setDraftInput('12'))
    act(() => view.result.current.commitLeverage())
    expect(onApplyLeverage).toHaveBeenCalledWith(12)
  })

  it('does not commit when the value is unchanged', () => {
    const { view, onApplyLeverage } = setup(5, 20)
    act(() => view.result.current.commitLeverage())
    expect(onApplyLeverage).not.toHaveBeenCalled()
  })

  it('re-seeds the draft when the committed leverage changes underneath', () => {
    const { view } = setup(5, 20)
    act(() => view.rerender({ leverage: 8 }))
    expect(view.result.current.draftInput).toBe('8')
  })
})
