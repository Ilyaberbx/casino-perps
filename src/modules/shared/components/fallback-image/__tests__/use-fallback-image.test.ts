import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFallbackImage } from '../use-fallback-image'

describe('useFallbackImage()', () => {
  it('starts on the first source', () => {
    const { result } = renderHook(() => useFallbackImage({ sources: ['a.png', 'b.png'] }))
    expect(result.current.currentSrc).toBe('a.png')
    expect(result.current.isExhausted).toBe(false)
  })

  it('advances to the next source on error', () => {
    const { result } = renderHook(() => useFallbackImage({ sources: ['a.png', 'b.png'] }))
    act(() => result.current.onError())
    expect(result.current.currentSrc).toBe('b.png')
    expect(result.current.isExhausted).toBe(false)
  })

  it('is exhausted after every source errors', () => {
    const { result } = renderHook(() => useFallbackImage({ sources: ['a.png', 'b.png'] }))
    act(() => result.current.onError())
    act(() => result.current.onError())
    expect(result.current.currentSrc).toBeNull()
    expect(result.current.isExhausted).toBe(true)
  })

  it('is immediately exhausted for an empty source list', () => {
    const { result } = renderHook(() => useFallbackImage({ sources: [] }))
    expect(result.current.isExhausted).toBe(true)
    expect(result.current.currentSrc).toBeNull()
  })

  it('restarts the chain when the sources identity changes', () => {
    const { result, rerender } = renderHook(
      ({ sources }) => useFallbackImage({ sources }),
      { initialProps: { sources: ['a.png', 'b.png'] } },
    )
    act(() => result.current.onError())
    expect(result.current.currentSrc).toBe('b.png')
    rerender({ sources: ['c.png'] })
    expect(result.current.currentSrc).toBe('c.png')
  })
})
