import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useVenueSession } from '../use-venue-session'
import type { VenueSessionOptions } from '../use-venue-session.types'
import { makeFakeLogger, makeVenueTracker } from '../__fixtures__/venue-session'

// One cast: the injected fake returns an opaque timer handle, typed to match
// the global `setTimeout` return so no production code special-cases tests.
const TIMER_HANDLE = 1 as unknown as ReturnType<typeof setTimeout>

function setup(overrides: Partial<VenueSessionOptions> = {}) {
  const { createVenue, created } = makeVenueTracker()
  let scheduled: (() => void) | null = null
  const fakeSetTimeout = vi.fn((handler: () => void) => {
    scheduled = handler
    return TIMER_HANDLE
  })
  const fakeClearTimeout = vi.fn()

  const initialProps: VenueSessionOptions = {
    venueId: 'mock',
    createVenue,
    logger: makeFakeLogger(),
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    ...overrides,
  }

  const view = renderHook((props: VenueSessionOptions) => useVenueSession(props), {
    initialProps,
  })

  return {
    view,
    created,
    createVenue,
    fakeSetTimeout,
    fakeClearTimeout,
    fireScheduled: () => act(() => scheduled?.()),
    initialProps,
  }
}

describe('useVenueSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates exactly one venue on mount', () => {
    const { created, view } = setup()
    expect(created).toHaveLength(1)
    expect(view.result.current.venue).toBe(created[0].venue)
  })

  it('rebuilds the venue on a venueId switch and disposes the previous one', () => {
    const { view, created, initialProps } = setup()

    act(() => {
      view.rerender({ ...initialProps, venueId: 'hyperliquid' })
    })

    expect(created).toHaveLength(2)
    // dispose is idempotent (Venue contract) — the rebuild updater and the
    // venue-change effect cleanup both dispose the previous venue. Assert it
    // was disposed, not the incidental call count.
    expect(created[0].dispose).toHaveBeenCalled()
    expect(view.result.current.venue).toBe(created[1].venue)
  })

  it('reconnect() rebuilds the venue, disposes the previous, and flags isReconnecting', () => {
    const { view, created } = setup()

    act(() => {
      view.result.current.recovery.reconnect()
    })

    expect(created).toHaveLength(2)
    expect(created[0].dispose).toHaveBeenCalled()
    expect(view.result.current.recovery.isReconnecting).toBe(true)
  })

  it('debounces reconnect with the injected guard timer', () => {
    const { view, created, fakeSetTimeout, fireScheduled } = setup()

    act(() => {
      view.result.current.recovery.reconnect()
    })
    expect(created).toHaveLength(2)
    expect(fakeSetTimeout).toHaveBeenCalledTimes(1)

    // Second click while the guard is pending is a no-op (no extra rebuild).
    act(() => {
      view.result.current.recovery.reconnect()
    })
    expect(created).toHaveLength(2)

    // Guard fires → reconnect is armed again.
    fireScheduled()
    expect(view.result.current.recovery.isReconnecting).toBe(false)

    act(() => {
      view.result.current.recovery.reconnect()
    })
    expect(created).toHaveLength(3)
  })

  it('disposes the active venue on unmount', () => {
    const { view, created } = setup()
    view.unmount()
    expect(created[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('clears a pending guard timer on unmount', () => {
    const { view, fakeClearTimeout } = setup()
    act(() => {
      view.result.current.recovery.reconnect()
    })
    view.unmount()
    expect(fakeClearTimeout).toHaveBeenCalledWith(TIMER_HANDLE)
  })
})
