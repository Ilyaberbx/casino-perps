import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { useCapabilityOptional } from '../use-capability-optional'
import { makeVenue, makeMarketDataReader, makeVenueWrapper } from '../__fixtures__/venue'

describe('useCapabilityOptional', () => {
  it('returns the narrowed reader when the venue implements the slot', () => {
    const marketData = makeMarketDataReader()
    const venue = makeVenue({ marketData })
    const { result } = renderHook(() => useCapabilityOptional('marketData'), {
      wrapper: makeVenueWrapper(venue),
    })
    expect(result.current).toBe(marketData)
  })

  it('returns undefined when the venue omits the slot — no throw', () => {
    const venue = makeVenue()
    const { result } = renderHook(() => useCapabilityOptional('marketData'), {
      wrapper: makeVenueWrapper(venue),
    })
    expect(result.current).toBeUndefined()
  })
})
