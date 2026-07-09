import { WARM_BATCH_SIZE, WARM_FETCH_TIMEOUT_MS } from './icon-warm-cache.constants'
import type { IconWarmCache } from './icon-warm-cache.types'

/**
 * Module-level singleton (same pattern as `services/toast/imperative-toast-queue.ts`).
 * Primes the market-icon Service Worker cache (ADR-0040) on idle. Stateless —
 * the SW owns the durable cache; this only issues the requests it intercepts.
 */
function createIconWarmCache(): IconWarmCache {
  function prime(url: string): void {
    const canFetch = typeof fetch === 'function'
    if (!canFetch) return
    // Fire-and-forget: the request is intercepted + cached by the icon Service
    // Worker. `no-cors` because the CDN sends no CORS headers (opaque is fine —
    // the SW caches and the <img> renders opaque responses). Bounded by an
    // AbortController so a stalled connection can't dangle; failures (incl. the
    // timeout abort) are swallowed.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WARM_FETCH_TIMEOUT_MS)
    void fetch(url, { mode: 'no-cors', signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timer))
  }

  function warmMany(urls: ReadonlyArray<string>): () => void {
    const canScheduleIdle = typeof requestIdleCallback === 'function'
    if (!canScheduleIdle) return () => {}

    let nextIndex = 0
    let handle = 0
    let isCancelled = false

    const runSlice = (): void => {
      if (isCancelled) return
      const sliceEnd = Math.min(nextIndex + WARM_BATCH_SIZE, urls.length)
      for (let i = nextIndex; i < sliceEnd; i += 1) {
        prime(urls[i])
      }
      nextIndex = sliceEnd
      const hasMore = nextIndex < urls.length
      if (!hasMore) return
      handle = requestIdleCallback(runSlice)
    }

    handle = requestIdleCallback(runSlice)

    return () => {
      isCancelled = true
      cancelIdleCallback(handle)
    }
  }

  return { warmMany }
}

export const iconWarmCache: IconWarmCache = createIconWarmCache()
