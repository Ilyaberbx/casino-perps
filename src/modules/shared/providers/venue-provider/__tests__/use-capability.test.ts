import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { useCapability } from '../use-capability'
import { makeVenue, makeMarketDataReader, makeVenueWrapper } from '../__fixtures__/venue'

describe('useCapability', () => {
  it('returns the narrowed reader when the venue implements the slot', () => {
    const marketData = makeMarketDataReader()
    const venue = makeVenue({ marketData })
    const { result } = renderHook(() => useCapability('marketData'), {
      wrapper: makeVenueWrapper(venue),
    })
    expect(result.current).toBe(marketData)
  })

  it('throws the canonical error when the venue omits the slot', () => {
    const venue = makeVenue()
    expect(() =>
      renderHook(() => useCapability('marketData'), { wrapper: makeVenueWrapper(venue) }),
    ).toThrow('venue is missing required capability: marketData')
  })

  it('returns the required connection capability without throwing', () => {
    const venue = makeVenue()
    const { result } = renderHook(() => useCapability('connection'), {
      wrapper: makeVenueWrapper(venue),
    })
    expect(result.current).toBe(venue.capabilities.connection)
  })
})
