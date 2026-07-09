// Hand-written, dependency-free Service Worker that cache-firsts asset icons
// from the TradingView symbol-logo CDN (primary) and the Hyperliquid coins CDN
// (crypto fallback). See docs/adr/0040-service-worker-icon-cache.md and
// docs/adr/0068-tradingview-first-icon-sourcing.md.
//
// Why: neither icon CDN sends `Cache-Control` or CORS headers, and the
// market-selection window virtualizes its rows, so large (10-150 KB) composite
// icons re-fetch + re-decode on every tab-switch/scroll remount -> flicker.
// Cache Storage can hold opaque cross-origin responses durably (unlike the
// browser memory cache, which evicts them under pressure), so a cache-first SW
// serves repeat icon requests with no network round-trip.
//
// It intercepts ONLY the icon allow-list; every other request passes through
// untouched (no respondWith), so app assets, the API, and Vite HMR are never
// affected.

const CACHE_NAME = 'market-icons-v3'
const MAX_ICON_ENTRIES = 1024
const TV_ICON_PREFIX = 'https://s3-symbol-logo.tradingview.com/'
const HL_ICON_PREFIX = 'https://app.hyperliquid.xyz/coins/'

function isIconRequest(url) {
  const isTvIcon = url.startsWith(TV_ICON_PREFIX)
  if (isTvIcon) return true
  return url.startsWith(HL_ICON_PREFIX)
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      const stale = names.filter((name) => name !== CACHE_NAME)
      await Promise.all(stale.map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

// FIFO trim so the cache cannot grow unbounded. The icon universe is a few
// hundred entries, so this rarely triggers.
async function trimCache(cache) {
  const keys = await cache.keys()
  const overflow = keys.length - MAX_ICON_ENTRIES
  if (overflow <= 0) return
  for (let i = 0; i < overflow; i += 1) {
    await cache.delete(keys[i])
  }
}

// A readable error response (status 4xx/5xx) must NOT be cached — otherwise a
// transient 404 freezes the icon to the letter placeholder until CACHE_NAME
// bumps (the IBM/BRENTOIL "no icon" class). Opaque (no-cors) responses report
// status 0 and an unreadable body, so they cannot be distinguished from an
// error here; they are cached (the SW's whole purpose) and a genuine 404 simply
// fails the <img> decode, advancing the resolver ladder to the next candidate.
function isCacheable(response) {
  if (response.type === 'opaque') return true
  return response.ok
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (isCacheable(response)) {
    await cache.put(request, response.clone())
    void trimCache(cache)
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (!isIconRequest(request.url)) return
  event.respondWith(cacheFirst(request).catch(() => fetch(request)))
})
