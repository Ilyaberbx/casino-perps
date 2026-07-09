import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { VenueOnboardingProvider } from '../VenueOnboardingProvider'
import { useVenueOnboarding } from '../use-venue-onboarding'
import type { VenueOnboarding } from '../../../domain'

function makeOnboarding(): VenueOnboarding {
  return {
    venueId: 'v',
    venueLabel: 'V',
    status: 'incomplete',
    steps: [],
    runAll: () => okAsync<void, never>(undefined),
    retryStep: () => okAsync<void, never>(undefined),
  }
}

describe('useVenueOnboarding', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useVenueOnboarding())).toThrow(
      /must be used inside/i,
    )
  })

  it('returns null when the active venue has no onboarding', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingProvider value={null}>{children}</VenueOnboardingProvider>
    )
    const { result } = renderHook(() => useVenueOnboarding(), { wrapper })
    expect(result.current).toBeNull()
  })

  it('returns the venue onboarding value passed in', () => {
    const onboarding = makeOnboarding()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingProvider value={onboarding}>{children}</VenueOnboardingProvider>
    )
    const { result } = renderHook(() => useVenueOnboarding(), { wrapper })
    expect(result.current).toBe(onboarding)
  })
})
