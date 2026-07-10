import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_WINS_ROTATE_INTERVAL_MS } from '../../../social.constants'
import { LIVE_WINS_SEED } from '../../../social.fixtures'
import { useLiveWins } from '../use-live-wins'

describe('useLiveWins', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('seeds the full window with stable, unique ids and animates by default', () => {
    const { result } = renderHook(() => useLiveWins())
    expect(result.current.wins).toHaveLength(LIVE_WINS_SEED.length)
    expect(result.current.isAnimated).toBe(true)
    const ids = result.current.wins.map((win) => win.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('rotates the window left one card per interval', () => {
    const { result } = renderHook(() => useLiveWins())
    const before = result.current.wins
    const originalHead = before[0]
    const originalSecond = before[1]

    act(() => {
      vi.advanceTimersByTime(LIVE_WINS_ROTATE_INTERVAL_MS)
    })

    const after = result.current.wins
    expect(after[0].id).toBe(originalSecond.id)
    expect(after[after.length - 1].id).toBe(originalHead.id)
  })

  it('keeps the window length fixed across many rotations (bounded memory)', () => {
    const { result } = renderHook(() => useLiveWins())
    act(() => {
      vi.advanceTimersByTime(LIVE_WINS_ROTATE_INTERVAL_MS * 50)
    })
    expect(result.current.wins).toHaveLength(LIVE_WINS_SEED.length)
  })
})
