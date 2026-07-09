import { describe, it, expect, beforeEach, vi } from 'vitest'

import { readVenueIdFromStorage, writeVenueIdToStorage } from '../venue-storage'
import { VENUE_STORAGE_KEY } from '../venues.constants'
import { DEFAULT_VENUE_ID } from '../venues'

describe('venue-storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips a known venue id', () => {
    writeVenueIdToStorage('mock')
    const result = readVenueIdFromStorage()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('mock')
  })

  it('falls back to default when nothing is stored', () => {
    const result = readVenueIdFromStorage()
    expect(result._unsafeUnwrap()).toBe(DEFAULT_VENUE_ID)
  })

  it('falls back to default for malformed values', () => {
    window.localStorage.setItem(VENUE_STORAGE_KEY, 'not-a-real-venue')
    const result = readVenueIdFromStorage()
    expect(result._unsafeUnwrap()).toBe(DEFAULT_VENUE_ID)
  })

  it('returns err when localStorage throws on read', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const result = readVenueIdFromStorage()
    expect(result.isErr()).toBe(true)
  })

  it('returns err when localStorage throws on write', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const result = writeVenueIdToStorage('mock')
    expect(result.isErr()).toBe(true)
  })
})
