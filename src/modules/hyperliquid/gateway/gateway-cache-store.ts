import { GATEWAY_CACHE_KEY_PREFIX } from './gateway-cache.constants'
import type { GatewayCacheEntry, GatewayCacheStore } from './gateway-cache.types'

/**
 * `localStorage`-backed TTL store for `withGatewayCache`. Survives reload and is
 * shared across tabs. Every `localStorage` touch is wrapped so a disabled /
 * quota-exceeded / no-window environment degrades to a miss or no-op rather
 * than throwing — the decorator then falls through to the live gateway call.
 *
 * `now` is injectable for deterministic expiry tests.
 */
export function createLocalStorageCacheStore(now: () => number = Date.now): GatewayCacheStore {
  return {
    read<T>(key: string): T | null {
      const storageKey = `${GATEWAY_CACHE_KEY_PREFIX}:${key}`
      const raw = safeGet(storageKey)
      if (raw === null) return null
      const entry = safeParse<GatewayCacheEntry<T>>(raw)
      if (entry === null) return null
      const isExpired = now() >= entry.expiresAt
      if (isExpired) {
        safeRemove(storageKey)
        return null
      }
      return entry.value
    },
    write<T>(key: string, value: T, ttlMs: number): void {
      const entry: GatewayCacheEntry<T> = { value, expiresAt: now() + ttlMs }
      safeSet(`${GATEWAY_CACHE_KEY_PREFIX}:${key}`, JSON.stringify(entry))
    },
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* quota exceeded / storage disabled — skip the write, next call re-fetches */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore — a stale entry that can't be removed will expire on next read */
  }
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
