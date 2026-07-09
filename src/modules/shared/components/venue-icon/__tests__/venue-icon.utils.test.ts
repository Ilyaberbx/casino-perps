import { describe, it, expect } from 'vitest'
import { resolveVenueIconSources } from '../venue-icon.utils'

describe('resolveVenueIconSources', () => {
  it('resolves a bare venue id to its bundled source', () => {
    expect(resolveVenueIconSources('hyperliquid')).not.toBeNull()
  })

  it('resolves a `:network`-suffixed id to the same source as the bare id', () => {
    expect(resolveVenueIconSources('hyperliquid:mainnet')).toBe(
      resolveVenueIconSources('hyperliquid'),
    )
  })

  it('returns null for an unknown venue id', () => {
    expect(resolveVenueIconSources('mock')).toBeNull()
  })
})
