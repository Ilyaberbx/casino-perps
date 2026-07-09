import { okAsync } from 'neverthrow'
import type { MockHistoryReader } from '../mock-venue.types'

/**
 * Generic one-shot history reader for the mock venue. Collapses the six
 * byte-identical IIFE readers (twap/trade/funding/order/interest/account-activity
 * history) that previously lived in `create-mock-venue.ts`.
 *
 * Behaviour (per `mock-venue/MODULE.md` gotchas): `subscribe` attaches a
 * listener and immediately emits the current entries; the first `loadOlder()`
 * appends `rows` and broadcasts, reporting `exhausted: true`; every subsequent
 * `loadOlder()` is a no-op returning `ok({ exhausted: true })`.
 */
export function createMockHistoryReader<TEntry>(
  rows: ReadonlyArray<TEntry>,
): MockHistoryReader<TEntry> {
  const listeners = new Set<(entries: ReadonlyArray<TEntry>) => void>()
  let entries: ReadonlyArray<TEntry> = []
  let fetched = false
  return {
    subscribe(onUpdate) {
      listeners.add(onUpdate)
      onUpdate(entries)
      return () => {
        listeners.delete(onUpdate)
      }
    },
    loadOlder() {
      if (fetched) return okAsync({ exhausted: true })
      fetched = true
      entries = rows
      for (const listener of listeners) listener(entries)
      return okAsync({ exhausted: true })
    },
  }
}
