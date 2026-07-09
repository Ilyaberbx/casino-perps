const ICON_CACHE_SW_URL = '/icon-cache-sw.js'

/**
 * Registers the market-icon caching Service Worker (ADR-0040). No-op where
 * Service Workers are unavailable (SSR / jsdom / older browsers). Registration
 * failure must never break the app — icons simply fall back to the (uncached)
 * network path.
 */
export function registerIconCacheServiceWorker(): void {
  const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  if (!isSupported) return
  void navigator.serviceWorker.register(ICON_CACHE_SW_URL).catch(() => {
    // Non-critical: the app works without the icon cache.
  })
}
