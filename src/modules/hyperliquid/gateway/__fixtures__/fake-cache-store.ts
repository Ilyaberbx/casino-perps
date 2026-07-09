import type { GatewayCacheEntry, GatewayCacheStore } from '../gateway-cache.types'

export interface FakeCacheStore extends GatewayCacheStore {
  /** Raw entry map — tests seed hits and assert on written entries directly. */
  readonly map: Map<string, GatewayCacheEntry<unknown>>
  /** Number of `write()` calls — lets tests assert a value was (not) cached. */
  writeCount(): number
}

/**
 * In-memory `GatewayCacheStore` for decorator tests. `now` is injectable so
 * expiry is deterministic without real timers. Mirrors the localStorage store's
 * read-time expiry semantics (`now() >= expiresAt` is a miss + delete).
 */
export function buildFakeCacheStore(now: () => number = () => 0): FakeCacheStore {
  const map = new Map<string, GatewayCacheEntry<unknown>>()
  let writes = 0
  return {
    map,
    writeCount: () => writes,
    read<T>(key: string): T | null {
      const entry = map.get(key)
      if (entry === undefined) return null
      const isExpired = now() >= entry.expiresAt
      if (isExpired) {
        map.delete(key)
        return null
      }
      // Safe: a stored entry's value type matches the `T` of the keyed reader.
      return entry.value as T
    },
    write<T>(key: string, value: T, ttlMs: number): void {
      writes += 1
      map.set(key, { value, expiresAt: now() + ttlMs })
    },
  }
}
