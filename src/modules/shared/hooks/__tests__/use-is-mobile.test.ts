import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { useIsMobile, MOBILE_MEDIA_QUERY } from '../use-is-mobile'
import type { FakeMediaQueryList } from '../__fixtures__/use-is-mobile.types'

function createFakeMediaQueryList(initialMatches: boolean): FakeMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql: FakeMediaQueryList = {
    matches: initialMatches,
    media: MOBILE_MEDIA_QUERY,
    addEventListener: (_type, listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener)
    },
    dispatch: (matches: boolean) => {
      mql.matches = matches
      const event = { matches, media: MOBILE_MEDIA_QUERY } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
  return mql
}

describe('useIsMobile', () => {
  let fakeMql: FakeMediaQueryList

  beforeEach(() => {
    fakeMql = createFakeMediaQueryList(false)
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => {
        if (query !== MOBILE_MEDIA_QUERY) throw new Error(`unexpected query: ${query}`)
        return fakeMql as unknown as MediaQueryList
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reflects matchMedia matches state on mount', () => {
    fakeMql = createFakeMediaQueryList(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('updates when the media query change event fires', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    act(() => {
      fakeMql.dispatch(true)
    })
    expect(result.current).toBe(true)
  })

  it('removes its change listener on unmount', () => {
    const removeSpy = vi.spyOn(fakeMql, 'removeEventListener')
    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
