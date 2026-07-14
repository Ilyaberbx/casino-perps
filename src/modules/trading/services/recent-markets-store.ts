import { Result } from 'neverthrow'
import { z } from 'zod'
import type { RecentMarketsPayload, RecentMarketsStore } from './recent-markets-store.types'

// No logger — a visited-market list is user behaviour, not something we log
// (logging.md hard rule 1). No React imports — this is a pure TS storage service.
// Deliberately mirrors `favorites-store.ts`: same versioned payload, same
// neverthrow boundaries, same degrade-to-empty on a corrupt value.

const recentMarketsPayloadSchema = z.object({
  version: z.literal(1),
  symbols: z.array(z.string()),
})

const EMPTY_PAYLOAD: RecentMarketsPayload = { version: 1, symbols: [] }

// Wrap localStorage.setItem at the boundary — any quota/security exception maps to the literal.
const safeSetItem = Result.fromThrowable(
  (key: string, value: string) => {
    localStorage.setItem(key, value)
  },
  (): 'storage-write-failed' => 'storage-write-failed',
)

// Only the localStorage read is a real failure — a SecurityError or a disabled
// store is something the caller must know about.
const safeGetItem = Result.fromThrowable(
  (key: string) => localStorage.getItem(key),
  (): 'storage-read-failed' => 'storage-read-failed',
)

// A corrupt VALUE, by contrast, is not a failure the caller can do anything with:
// unparseable JSON and a stale shape both degrade to an empty list. Kept separate
// from `safeGetItem` precisely so a `JSON.parse` throw cannot masquerade as
// "storage is broken" and vice versa.
function parsePayload(raw: string): RecentMarketsPayload {
  const parsed = Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => null,
  )()
  if (parsed.isErr()) return EMPTY_PAYLOAD
  const validated = recentMarketsPayloadSchema.safeParse(parsed.value)
  return validated.success ? validated.data : EMPTY_PAYLOAD
}

function loadFrom(key: string): Result<RecentMarketsPayload, 'storage-read-failed'> {
  return safeGetItem(key).map((raw) => (raw === null ? EMPTY_PAYLOAD : parsePayload(raw)))
}

export function createRecentMarketsStore(): RecentMarketsStore {
  return {
    load(key) {
      return loadFrom(key)
    },
    save(key, payload) {
      return safeSetItem(key, JSON.stringify(payload))
    },
  }
}
