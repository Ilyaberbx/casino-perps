import { Result } from 'neverthrow'
import { z } from 'zod'

// No logger — symbol data is non-sensitive but this is a pure TS storage
// service with no React imports (mirrors favorites-store.ts).

/**
 * Sheet-owned persistence for the AI Suggestion sheet's last-used symbol
 * (ADR-0056). The sheet seeds its symbol from this store, NOT from the Trade
 * Page's selected market — that severs the terminal coupling that produced the
 * "market is wrong" bug. A missing/corrupt entry falls back to the caller's
 * static default.
 */

export const SUGGESTION_SYMBOL_STORAGE_KEY = 'perps-suggestion-symbol'

const symbolPayloadSchema = z.object({
  version: z.literal(1),
  symbol: z.string().min(1),
})

export type SuggestionSymbolPayload = z.infer<typeof symbolPayloadSchema>

export interface SuggestionSymbolStore {
  /** Load the persisted last-used symbol. `null` when none is stored or the
   *  entry is corrupt — the caller substitutes its own default. */
  load(): string | null
  /** Persist the last-used symbol. Swallows storage failures (best-effort —
   *  a failed write only loses the convenience seed, never blocks the flow). */
  save(symbol: string): void
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

function parseSymbol(raw: string | null): string | null {
  if (raw === null) return null
  const parseAttempt = Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => null,
  )()
  if (parseAttempt.isErr()) return null
  const validated = symbolPayloadSchema.safeParse(parseAttempt.value)
  return validated.success ? validated.data.symbol : null
}

export function createSuggestionSymbolStore(
  key: string = SUGGESTION_SYMBOL_STORAGE_KEY,
): SuggestionSymbolStore {
  return {
    load() {
      const readResult = safeGetItem(key)
      return readResult.isOk() ? parseSymbol(readResult.value) : null
    },
    save(symbol) {
      const payload: SuggestionSymbolPayload = { version: 1, symbol }
      safeSetItem(key, JSON.stringify(payload))
    },
  }
}
