import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsVenueOnboardingReady } from '../use-is-venue-onboarding-ready'
import {
  makeSyntheticVenue,
  makeVenueOnboarding,
  wrapWithVenue,
} from '../__fixtures__/venue-onboarding'

describe('useIsVenueOnboardingReady', () => {
  it('returns true when venue has no onboarding capability', () => {
    const venue = makeSyntheticVenue()
    const { result } = renderHook(() => useIsVenueOnboardingReady(), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(true)
  })

  it('returns true when onboarding status is ready', () => {
    const onboarding = makeVenueOnboarding({ status: 'ready' })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueOnboardingReady(), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(true)
  })

  it('returns false when onboarding status is incomplete', () => {
    const onboarding = makeVenueOnboarding({ status: 'incomplete' })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueOnboardingReady(), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(false)
  })

  it('returns false when onboarding status is bootstrapping', () => {
    const onboarding = makeVenueOnboarding({ status: 'bootstrapping' })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueOnboardingReady(), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(false)
  })

  it('returns false when onboarding status is blocked', () => {
    const onboarding = makeVenueOnboarding({
      status: { kind: 'blocked', reason: 'wallet-disconnected' },
    })
    const venue = makeSyntheticVenue({ onboarding })
    const { result } = renderHook(() => useIsVenueOnboardingReady(), {
      wrapper: wrapWithVenue(venue),
    })
    expect(result.current).toBe(false)
  })
})
