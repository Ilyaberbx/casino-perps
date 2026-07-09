import { Result } from 'neverthrow'
import { z } from 'zod'

// No logger — non-sensitive ids only, and this is a pure TS storage service with
// no React imports (mirrors suggestion-symbol-store.ts).

/**
 * Persists the set of suggestion ids whose outcome the user has already been
 * toasted about (ADR-0073 D-5). The server `/inbox` is the source of truth for
 * outcomes; this store only records what's been acknowledged, so a reload does
 * NOT re-toast an already-seen outcome, while an outcome that resolved WHILE THE
 * USER WAS AWAY (never acknowledged) toasts exactly once on return. Each entry
 * is stamped with the ack time and pruned past the ~24h inbox window.
 */

export const SUGGESTION_ACK_STORAGE_KEY = 'suggestion.acked.v1'

const ACK_RETENTION_MS = 24 * 60 * 60 * 1_000

const ackPayloadSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.object({ id: z.string(), ackedAt: z.number() })),
})

export interface SuggestionAckStore {
  /** The acknowledged ids still within the retention window. */
  load(): readonly string[]
  /** Record an id as acknowledged at `nowMs`, pruning expired entries. */
  ack(id: string, nowMs: number): void
}

const safeGetItem = Result.fromThrowable(
  (key: string) => localStorage.getItem(key),
  (): 'storage-read-failed' => 'storage-read-failed',
)

const safeSetItem = Result.fromThrowable(
  (key: string, value: string) => {
    localStorage.setItem(key, value)
  },
  (): 'storage-write-failed' => 'storage-write-failed',
)

function parseEntries(raw: string | null): ReadonlyArray<{ id: string; ackedAt: number }> {
  if (raw === null) return []
  const parseAttempt = Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => null,
  )()
  if (parseAttempt.isErr()) return []
  const validated = ackPayloadSchema.safeParse(parseAttempt.value)
  return validated.success ? validated.data.entries : []
}

function readEntries(key: string): ReadonlyArray<{ id: string; ackedAt: number }> {
  const readResult = safeGetItem(key)
  return readResult.isOk() ? parseEntries(readResult.value) : []
}

export function createSuggestionAckStore(
  key: string = SUGGESTION_ACK_STORAGE_KEY,
): SuggestionAckStore {
  return {
    load() {
      return readEntries(key).map((entry) => entry.id)
    },
    ack(id, nowMs) {
      const cutoff = nowMs - ACK_RETENTION_MS
      const isFresh = (entry: { ackedAt: number }) => entry.ackedAt >= cutoff
      const isOtherId = (entry: { id: string }) => entry.id !== id
      const kept = readEntries(key).filter((entry) => isFresh(entry) && isOtherId(entry))
      const entries = [...kept, { id, ackedAt: nowMs }]
      safeSetItem(key, JSON.stringify({ version: 1, entries }))
    },
  }
}
