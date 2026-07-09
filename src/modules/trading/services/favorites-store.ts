import { Result } from 'neverthrow'
import { z } from 'zod'

// No logger — favorites data must never be logged to avoid PII leakage (logging.md hard rule 1).
// No React imports — this is a pure TS storage service.

const favoritesPayloadSchema = z.object({
  version: z.literal(1),
  symbols: z.array(z.string()),
})

export type FavoritesPayload = z.infer<typeof favoritesPayloadSchema>

export interface FavoritesStore {
  /** Load persisted favorites from localStorage.
   *  Returns ok({ version: 1, symbols: [] }) when no entry exists.
   *  Migrates bare string[] entries to the versioned shape (WL-01 SC-3).
   *  Returns err('storage-read-failed') if localStorage.getItem throws. */
  load(key: string): Result<FavoritesPayload, 'storage-read-failed'>
  /** Persist favorites to localStorage.
   *  Returns ok(undefined) on success.
   *  Returns err('storage-write-failed') if localStorage.setItem throws (e.g. QuotaExceededError). */
  save(key: string, payload: FavoritesPayload): Result<void, 'storage-write-failed'>
}

const EMPTY_PAYLOAD: FavoritesPayload = { version: 1, symbols: [] }

// Accepts unknown input and attempts to coerce it to FavoritesPayload.
// Returns null for any input shape that cannot be migrated.
function migrate(raw: unknown): FavoritesPayload | null {
  const versioned = favoritesPayloadSchema.safeParse(raw)
  if (versioned.success) return versioned.data

  const bareArray = z.array(z.string()).safeParse(raw)
  if (bareArray.success) return { version: 1 as const, symbols: bareArray.data }

  return null
}

// Wrap localStorage.setItem at the boundary — any quota/security exception maps to the literal.
const safeSetItem = Result.fromThrowable(
  (key: string, value: string) => { localStorage.setItem(key, value) },
  (): 'storage-write-failed' => 'storage-write-failed',
)

// Wrap the entire load body in Result.fromThrowable to capture localStorage.getItem exceptions.
function makeLoadFn(key: string): Result<FavoritesPayload, 'storage-read-failed'> {
  const safeLoad = Result.fromThrowable(
    () => {
      const raw = localStorage.getItem(key)
      if (raw === null) return EMPTY_PAYLOAD
      const parsed: unknown = JSON.parse(raw)
      const migrated = migrate(parsed)
      if (migrated !== null) return migrated
      return EMPTY_PAYLOAD
    },
    (): 'storage-read-failed' => 'storage-read-failed',
  )
  return safeLoad()
}

export function createFavoritesStore(): FavoritesStore {
  return {
    load(key) {
      return makeLoadFn(key)
    },
    save(key, payload) {
      return safeSetItem(key, JSON.stringify(payload))
    },
  }
}
