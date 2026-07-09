import { describe, it, expect, beforeEach } from 'vitest'
import { createSuggestionAckStore } from '../suggestion-ack-store'

const KEY = 'test.suggestion.acked.v1'
const HOUR_MS = 60 * 60 * 1_000

describe('suggestion-ack-store', () => {
  beforeEach(() => localStorage.clear())

  it('starts empty', () => {
    expect(createSuggestionAckStore(KEY).load()).toEqual([])
  })

  it('records acknowledged ids and reads them back', () => {
    const store = createSuggestionAckStore(KEY)
    const now = Date.now()
    store.ack('a', now)
    store.ack('b', now)
    expect([...store.load()].sort()).toEqual(['a', 'b'])
  })

  it('is idempotent for the same id (no duplicate entries)', () => {
    const store = createSuggestionAckStore(KEY)
    const now = Date.now()
    store.ack('a', now)
    store.ack('a', now + 1)
    expect(store.load()).toEqual(['a'])
  })

  it('prunes entries older than the ~24h window on write', () => {
    const store = createSuggestionAckStore(KEY)
    const t0 = 1_000_000_000
    store.ack('old', t0)
    // 25h later — the old entry is past retention and should be dropped.
    store.ack('new', t0 + 25 * HOUR_MS)
    expect(store.load()).toEqual(['new'])
  })

  it('survives a corrupt payload (returns empty, then writes cleanly)', () => {
    localStorage.setItem(KEY, 'not json')
    const store = createSuggestionAckStore(KEY)
    expect(store.load()).toEqual([])
    store.ack('a', Date.now())
    expect(store.load()).toEqual(['a'])
  })
})
