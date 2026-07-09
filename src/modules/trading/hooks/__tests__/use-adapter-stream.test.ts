import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAdapterStream } from '../use-adapter-stream'

// Notifications are coalesced to one per animation frame (ADR-0043): the reducer
// runs synchronously on every event, but React is told to re-read the snapshot on
// the next frame. Flush one rAF (inside act) before asserting rendered state.
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('useAdapterStream', () => {
  it('returns the initial state before any event arrives', () => {
    const subscribe = vi.fn(() => () => {})
    const { result } = renderHook(() =>
      useAdapterStream<number, number>({
        initial: 7,
        subscribe,
        reducer: (previous, event) => previous + event,
      }),
    )
    expect(result.current).toBe(7)
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('applies reducer to incoming events and notifies the renderer', async () => {
    let capturedCallback: ((event: number) => void) | undefined
    const subscribe = vi.fn((cb: (event: number) => void) => {
      capturedCallback = cb
      return () => {}
    })
    const { result } = renderHook(() =>
      useAdapterStream<number, number>({
        initial: 0,
        subscribe,
        reducer: (previous, event) => previous + event,
      }),
    )
    act(() => {
      capturedCallback?.(2)
      capturedCallback?.(3)
    })
    // Both events reduced synchronously (2+3); the coalesced notify lands next frame.
    await flushFrame()
    expect(result.current).toBe(5)
  })

  it('calls source-unsubscribe on unmount', () => {
    const unsubscribe = vi.fn()
    const subscribe = vi.fn(() => unsubscribe)
    const { unmount } = renderHook(() =>
      useAdapterStream<number, number>({
        initial: 0,
        subscribe,
        reducer: (previous, event) => previous + event,
      }),
    )
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('resubscribes when subscribe identity changes', () => {
    const unsubscribeA = vi.fn()
    const unsubscribeB = vi.fn()
    const subscribeA = vi.fn(() => unsubscribeA)
    const subscribeB = vi.fn(() => unsubscribeB)
    const { rerender } = renderHook(
      ({ subscribe }: { subscribe: (cb: (e: number) => void) => () => void }) =>
        useAdapterStream<number, number>({
          initial: 0,
          subscribe,
          reducer: (previous, event) => previous + event,
        }),
      { initialProps: { subscribe: subscribeA } },
    )
    rerender({ subscribe: subscribeB })
    expect(unsubscribeA).toHaveBeenCalledTimes(1)
    expect(subscribeB).toHaveBeenCalledTimes(1)
  })

  it('resets state to initial on resubscribe when resetOnSubscribe is true', async () => {
    let capturedCallback: ((event: number) => void) | undefined
    const subscribeA = vi.fn((cb: (event: number) => void) => {
      capturedCallback = cb
      return () => {}
    })
    const subscribeB = vi.fn((cb: (event: number) => void) => {
      capturedCallback = cb
      return () => {}
    })
    const { result, rerender } = renderHook(
      ({ subscribe }: { subscribe: (cb: (e: number) => void) => () => void }) =>
        useAdapterStream<number, number>({
          initial: 0,
          subscribe,
          reducer: (previous, event) => previous + event,
          resetOnSubscribe: true,
        }),
      { initialProps: { subscribe: subscribeA } },
    )
    act(() => {
      capturedCallback?.(10)
    })
    await flushFrame()
    expect(result.current).toBe(10)
    // Reset happens synchronously in subscribe() on the resubscribe re-render.
    rerender({ subscribe: subscribeB })
    expect(result.current).toBe(0)
  })
})
