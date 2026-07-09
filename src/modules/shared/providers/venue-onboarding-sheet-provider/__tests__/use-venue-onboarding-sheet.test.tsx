import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { VenueOnboardingSheetProvider } from '../VenueOnboardingSheetProvider'
import { useVenueOnboardingSheet } from '../use-venue-onboarding-sheet'

describe('useVenueOnboardingSheet', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useVenueOnboardingSheet())).toThrow(
      /must be used inside/i,
    )
  })

  it('starts closed and toggles via open / close', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
    )
    const { result } = renderHook(() => useVenueOnboardingSheet(), { wrapper })

    expect(result.current.isOpen).toBe(false)
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('respects defaultOpen', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingSheetProvider defaultOpen>{children}</VenueOnboardingSheetProvider>
    )
    const { result } = renderHook(() => useVenueOnboardingSheet(), { wrapper })
    expect(result.current.isOpen).toBe(true)
  })
})
