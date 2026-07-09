import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsVenueCapabilityReady } from '../use-is-venue-capability-ready'
import {
  makeOnboardingStep,
  makeSyntheticVenue,
  makeVenueOnboarding,
  wrapWithVenue,
} from '../__fixtures__/venue-onboarding'

describe('useIsVenueCapabilityReady', () => {
  it('returns true when venue has no onboarding capability', () => {
    const venue = makeSyntheticVenue()
    const { result } = renderHook(() => useIsVenueCapabilityReady('sign-actions'), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(true)
  })

  it('returns true when a step with the capability is complete', () => {
    const onboarding = makeVenueOnboarding({
      steps: [
        makeOnboardingStep({ id: 'agent', capability: 'sign-actions', status: 'complete' }),
      ],
    })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueCapabilityReady('sign-actions'), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(true)
  })

  it('returns false when the only step with the capability is pending', () => {
    const onboarding = makeVenueOnboarding({
      steps: [
        makeOnboardingStep({ id: 'agent', capability: 'sign-actions', status: 'pending' }),
      ],
    })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueCapabilityReady('sign-actions'), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(false)
  })

  it('returns false when no step exposes the requested capability', () => {
    const onboarding = makeVenueOnboarding({
      steps: [
        makeOnboardingStep({ id: 'builder', capability: 'route-fees', status: 'complete' }),
      ],
    })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueCapabilityReady('sign-actions'), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(false)
  })
})
