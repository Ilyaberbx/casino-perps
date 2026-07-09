import { describe, expect, it } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { VenueOnboardingSeenStoreProvider } from '../VenueOnboardingSeenStoreProvider'
import { useVenueOnboardingSeenStore } from '../use-venue-onboarding-seen-store'
import { createVenueOnboardingSeenStore } from '../../../services/venue-onboarding-seen-store'
import {
  buildFakeLogger,
  buildFakeStorage,
} from '../../../services/__fixtures__/venue-onboarding-seen-store'

function buildStore() {
  const storage = buildFakeStorage()
  const { logger } = buildFakeLogger()
  return { store: createVenueOnboardingSeenStore({ storage, logger }), storage }
}

describe('VenueOnboardingSeenStoreProvider', () => {
  it('throws if useVenueOnboardingSeenStore is called outside the provider', () => {
    expect(() => renderHook(() => useVenueOnboardingSeenStore())).toThrow(
      /must be used inside/i,
    )
  })

  it('exposes default state when no key is present in storage', () => {
    const { store } = buildStore()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingSeenStoreProvider
        privyId="did:privy:abc"
        venueId="hyperliquid"
        store={store}
      >
        {children}
      </VenueOnboardingSeenStoreProvider>
    )
    const { result } = renderHook(() => useVenueOnboardingSeenStore(), { wrapper })
    expect(result.current.state).toEqual({
      hasSeenOnboarding: false,
      hasSeenMigrationNotice: false,
    })
  })

  it('markMigrationDismissed flips the flag and persists', () => {
    const { store, storage } = buildStore()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingSeenStoreProvider
        privyId="did:privy:abc"
        venueId="hyperliquid"
        store={store}
      >
        {children}
      </VenueOnboardingSeenStoreProvider>
    )
    const { result } = renderHook(() => useVenueOnboardingSeenStore(), { wrapper })
    act(() => {
      result.current.markMigrationDismissed()
    })
    expect(result.current.state.hasSeenMigrationNotice).toBe(true)
    expect(storage.data.has('venue-onboarding-seen:did:privy:abc:hyperliquid')).toBe(true)
  })

  it('re-reads from storage when privyId changes', () => {
    const storage = buildFakeStorage({
      'venue-onboarding-seen:did:privy:user1:hyperliquid': JSON.stringify({
        hasSeenOnboarding: false,
        hasSeenMigrationNotice: true,
      }),
    })
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })

    function Probe({ id }: { id: string }) {
      const ctx = useVenueOnboardingSeenStore()
      return <span data-testid={id}>{String(ctx.state.hasSeenMigrationNotice)}</span>
    }

    const { rerender, getByTestId } = render(
      <VenueOnboardingSeenStoreProvider
        privyId="did:privy:user1"
        venueId="hyperliquid"
        store={store}
      >
        <Probe id="probe" />
      </VenueOnboardingSeenStoreProvider>,
    )
    expect(getByTestId('probe').textContent).toBe('true')

    rerender(
      <VenueOnboardingSeenStoreProvider
        privyId="did:privy:user2"
        venueId="hyperliquid"
        store={store}
      >
        <Probe id="probe" />
      </VenueOnboardingSeenStoreProvider>,
    )
    expect(getByTestId('probe').textContent).toBe('false')
  })

  it('is a no-op when privyId is null', () => {
    const { store, storage } = buildStore()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VenueOnboardingSeenStoreProvider privyId={null} venueId="hyperliquid" store={store}>
        {children}
      </VenueOnboardingSeenStoreProvider>
    )
    const { result } = renderHook(() => useVenueOnboardingSeenStore(), { wrapper })
    act(() => {
      result.current.markMigrationDismissed()
    })
    expect(result.current.state.hasSeenMigrationNotice).toBe(false)
    expect(storage.data.size).toBe(0)
  })
})
