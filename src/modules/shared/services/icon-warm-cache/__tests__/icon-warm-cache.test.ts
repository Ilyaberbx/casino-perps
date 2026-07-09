import { describe, it, expect, vi, afterEach } from 'vitest'
import { iconWarmCache } from '../icon-warm-cache'

const originalRIC = globalThis.requestIdleCallback
const originalCIC = globalThis.cancelIdleCallback
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.requestIdleCallback = originalRIC
  globalThis.cancelIdleCallback = originalCIC
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

// Drive idle callbacks synchronously so the chunked loop runs to completion.
function installSyncIdle(): void {
  globalThis.requestIdleCallback = ((cb: IdleRequestCallback) => {
    cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
    return 1
  }) as typeof requestIdleCallback
  globalThis.cancelIdleCallback = (() => {}) as typeof cancelIdleCallback
}

describe('iconWarmCache.warmMany', () => {
  it('primes every url via a no-cors fetch the Service Worker can cache', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    installSyncIdle()
    const urls = ['https://cdn.test/a.svg', 'https://cdn.test/b.svg']

    iconWarmCache.warmMany(urls)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/a.svg', {
      mode: 'no-cors',
      signal: expect.any(AbortSignal),
    })
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/b.svg', {
      mode: 'no-cors',
      signal: expect.any(AbortSignal),
    })
  })

  it('returns a callable no-op cancel and primes nothing when idle scheduling is unavailable', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    // @ts-expect-error — force the unavailable (jsdom) path
    globalThis.requestIdleCallback = undefined

    const cancel = iconWarmCache.warmMany(['https://cdn.test/c.svg'])

    expect(typeof cancel).toBe('function')
    expect(() => cancel()).not.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancel() stops a slice scheduled but not yet run', () => {
    // Init with a noop so TS keeps it callable (it is only reassigned inside the
    // stub closure, which TS cannot see narrow).
    let scheduled: IdleRequestCallback = () => {}
    const fetchMock = vi.fn(() => Promise.resolve(new Response()))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    globalThis.requestIdleCallback = ((cb: IdleRequestCallback) => {
      scheduled = cb
      return 7
    }) as typeof requestIdleCallback
    const cancelSpy = vi.fn()
    globalThis.cancelIdleCallback = cancelSpy as unknown as typeof cancelIdleCallback

    const cancel = iconWarmCache.warmMany(['https://cdn.test/d.svg'])
    cancel()
    // Run the captured slice AFTER cancel — it must no-op.
    scheduled({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)

    expect(cancelSpy).toHaveBeenCalledWith(7)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
