import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useVenueOnboardingSheetContent } from '../use-venue-onboarding-sheet-content'
import {
  buildFakeActions,
  buildFakeVenueOnboarding,
  wrapWithOnboarding,
} from '../__fixtures__/fake-venue-onboarding'
import { VenueOnboardingSeenStoreProvider } from '../../../providers/venue-onboarding-seen-store-provider'
import { createVenueOnboardingSeenStore } from '../../../services/venue-onboarding-seen-store'
import {
  buildFakeLogger,
  buildFakeStorage,
} from '../../../services/__fixtures__/venue-onboarding-seen-store'
import type { VenueOnboardingStep } from '../../../domain'

function step(
  id: string,
  status: VenueOnboardingStep['status'],
): VenueOnboardingStep {
  return { id, label: id, description: `desc ${id}`, status }
}

function wrapWithSeenStore(opts: {
  privyId?: string | null
  venueId?: string | null
  initialStorage?: Record<string, string>
  Outer: React.ComponentType<{ children: ReactNode }>
}) {
  const storage = buildFakeStorage(opts.initialStorage)
  const { logger } = buildFakeLogger()
  const store = createVenueOnboardingSeenStore({ storage, logger })
  const { Outer } = opts
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Outer>
        <VenueOnboardingSeenStoreProvider
          privyId={opts.privyId ?? 'did:privy:abc'}
          venueId={opts.venueId ?? 'hyperliquid'}
          store={store}
        >
          {children}
        </VenueOnboardingSeenStoreProvider>
      </Outer>
    )
  }
  return { Wrapper, storage }
}

describe('useVenueOnboardingSheetContent — migration notice derivation', () => {
  it('derives showMigrationNotice=true when agent complete + builder incomplete + unseen', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [step('agent', 'complete'), step('builder', 'pending')],
    })
    const outer = wrapWithOnboarding({ onboarding })
    const { Wrapper } = wrapWithSeenStore({ Outer: outer })
    const { result } = renderHook(
      () => useVenueOnboardingSheetContent({ actions: buildFakeActions() }),
      { wrapper: Wrapper },
    )
    expect(result.current.showMigrationNotice).toBe(true)
  })

  it('derives showMigrationNotice=false when both steps complete', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [step('agent', 'complete'), step('builder', 'complete')],
    })
    const outer = wrapWithOnboarding({ onboarding })
    const { Wrapper } = wrapWithSeenStore({ Outer: outer })
    const { result } = renderHook(
      () => useVenueOnboardingSheetContent({ actions: buildFakeActions() }),
      { wrapper: Wrapper },
    )
    expect(result.current.showMigrationNotice).toBe(false)
  })

  it('derives showMigrationNotice=false when agent not complete', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [step('agent', 'pending'), step('builder', 'pending')],
    })
    const outer = wrapWithOnboarding({ onboarding })
    const { Wrapper } = wrapWithSeenStore({ Outer: outer })
    const { result } = renderHook(
      () => useVenueOnboardingSheetContent({ actions: buildFakeActions() }),
      { wrapper: Wrapper },
    )
    expect(result.current.showMigrationNotice).toBe(false)
  })

  it('suppresses notice when the seen-store says hasSeenMigrationNotice=true', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [step('agent', 'complete'), step('builder', 'pending')],
    })
    const outer = wrapWithOnboarding({ onboarding })
    const { Wrapper } = wrapWithSeenStore({
      Outer: outer,
      initialStorage: {
        'venue-onboarding-seen:did:privy:abc:hyperliquid': JSON.stringify({
          hasSeenOnboarding: false,
          hasSeenMigrationNotice: true,
        }),
      },
    })
    const { result } = renderHook(
      () => useVenueOnboardingSheetContent({ actions: buildFakeActions() }),
      { wrapper: Wrapper },
    )
    expect(result.current.showMigrationNotice).toBe(false)
  })

  it('onDismissMigrationNotice writes through the seen store and suppresses re-render', () => {
    const onboarding = buildFakeVenueOnboarding({
      steps: [step('agent', 'complete'), step('builder', 'pending')],
    })
    const outer = wrapWithOnboarding({ onboarding })
    const { Wrapper, storage } = wrapWithSeenStore({ Outer: outer })
    const { result } = renderHook(
      () => useVenueOnboardingSheetContent({ actions: buildFakeActions() }),
      { wrapper: Wrapper },
    )
    expect(result.current.showMigrationNotice).toBe(true)
    act(() => {
      result.current.onDismissMigrationNotice()
    })
    expect(storage.data.has('venue-onboarding-seen:did:privy:abc:hyperliquid')).toBe(true)
    expect(result.current.showMigrationNotice).toBe(false)
  })
})
