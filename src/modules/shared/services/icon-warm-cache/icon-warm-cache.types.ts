/**
 * Idle preloader that primes the market-icon Service Worker cache
 * (ADR-0040). The SW (`public/icon-cache-sw.js`) is the durable cache; this
 * just issues the requests it caches, SPOT FIRST, so the first Spot switch is
 * already served from Cache Storage instead of flickering. See the asset-icon
 * section of `shared/MODULE.md`.
 */
export interface IconWarmCache {
  /** Idle-prime the SW icon cache for a market universe. Returns a cancel
   *  function. No-op where idle scheduling / fetch are unavailable (SSR/jsdom). */
  warmMany(urls: ReadonlyArray<string>): () => void
}
