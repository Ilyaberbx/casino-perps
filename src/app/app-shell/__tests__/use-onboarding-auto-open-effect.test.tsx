import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { ok } from 'neverthrow'
import { VenueOnboardingSheetContext } from '@/modules/shared/providers/venue-onboarding-sheet-provider/venue-onboarding-sheet-provider.context'
import { VenueOnboardingSeenStoreContext } from '@/modules/shared/providers/venue-onboarding-seen-store-provider/venue-onboarding-seen-store-provider.context'
import type { VenueOnboardingSeenStoreContextValue } from '@/modules/shared/providers/venue-onboarding-seen-store-provider'
import { buildFakeVenueOnboarding } from '@/modules/shared/components/VenueOnboardingSheet/__fixtures__/fake-venue-onboarding'
import type {
  SeenState,
  VenueOnboardingSeenStore,
} from '@/modules/shared/services/venue-onboarding-seen-store'
import type {
  VenueOnboarding,
  VenueOnboardingStatus,
} from '@/modules/shared/domain'
import { useOnboardingAutoOpenEffect } from '../use-onboarding-auto-open-effect'

interface HarnessProps {
  readonly status: VenueOnboardingStatus
}

function Harness({ status }: HarnessProps) {
  const onboarding: VenueOnboarding = buildFakeVenueOnboarding({
    status,
    venueLabel: 'Hyperliquid',
  })
  useOnboardingAutoOpenEffect(onboarding)
  return null
}

interface BuildStubOptions {
  readonly hasSeenOnboarding: boolean
  readonly markAutoOpened?: () => void
  readonly mounted?: boolean
}

interface WrapperOptions {
  readonly openSpy: () => void
  readonly seen: BuildStubOptions
}

function buildFakeStore(): VenueOnboardingSeenStore {
  return {
    load: () => ok({ hasSeenOnboarding: false, hasSeenMigrationNotice: false }),
    markAutoOpened: () => ok(undefined),
    markMigrationDismissed: () => ok(undefined),
    reset: () => ok(undefined),
  }
}

function buildSeenContextValue(options: BuildStubOptions): VenueOnboardingSeenStoreContextValue {
  const state: SeenState = {
    hasSeenOnboarding: options.hasSeenOnboarding,
    hasSeenMigrationNotice: false,
  }
  return {
    privyId: 'did:privy:test',
    venueId: 'hyperliquid',
    state,
    store: buildFakeStore(),
    markMigrationDismissed: () => {},
    markAutoOpened: options.markAutoOpened ?? (() => {}),
  }
}

function buildWrapper({ openSpy, seen }: WrapperOptions) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    const sheetValue = { isOpen: false, open: openSpy, close: () => {} }
    const seenValue = buildSeenContextValue(seen)
    const mounted = seen.mounted ?? true
    if (!mounted) {
      return (
        <VenueOnboardingSheetContext.Provider value={sheetValue}>
          {children}
        </VenueOnboardingSheetContext.Provider>
      )
    }
    return (
      <VenueOnboardingSheetContext.Provider value={sheetValue}>
        <VenueOnboardingSeenStoreContext.Provider value={seenValue}>
          {children}
        </VenueOnboardingSeenStoreContext.Provider>
      </VenueOnboardingSheetContext.Provider>
    )
  }
}

describe('useOnboardingAutoOpenEffect', () => {
  it('opens the sheet and marks auto-opened on bootstrapping → incomplete (unseen)', () => {
    const openSpy = vi.fn()
    const markAutoOpened = vi.fn()
    const Wrapper = buildWrapper({
      openSpy,
      seen: { hasSeenOnboarding: false, markAutoOpened },
    })

    const { rerender } = render(
      <Wrapper>
        <Harness status="bootstrapping" />
      </Wrapper>,
    )

    expect(openSpy).not.toHaveBeenCalled()
    expect(markAutoOpened).not.toHaveBeenCalled()

    rerender(
      <Wrapper>
        <Harness status="incomplete" />
      </Wrapper>,
    )

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(markAutoOpened).toHaveBeenCalledTimes(1)
  })

  it('does NOT open the sheet on bootstrapping → incomplete when already seen', () => {
    const openSpy = vi.fn()
    const markAutoOpened = vi.fn()
    const Wrapper = buildWrapper({
      openSpy,
      seen: { hasSeenOnboarding: true, markAutoOpened },
    })

    const { rerender } = render(
      <Wrapper>
        <Harness status="bootstrapping" />
      </Wrapper>,
    )
    rerender(
      <Wrapper>
        <Harness status="incomplete" />
      </Wrapper>,
    )

    expect(openSpy).not.toHaveBeenCalled()
    expect(markAutoOpened).not.toHaveBeenCalled()
  })

  it('does NOT open the sheet on bootstrapping → ready', () => {
    const openSpy = vi.fn()
    const markAutoOpened = vi.fn()
    const Wrapper = buildWrapper({
      openSpy,
      seen: { hasSeenOnboarding: false, markAutoOpened },
    })

    const { rerender } = render(
      <Wrapper>
        <Harness status="bootstrapping" />
      </Wrapper>,
    )
    rerender(
      <Wrapper>
        <Harness status="ready" />
      </Wrapper>,
    )

    expect(openSpy).not.toHaveBeenCalled()
    expect(markAutoOpened).not.toHaveBeenCalled()
  })

  it('does NOT open during bootstrapping itself', () => {
    const openSpy = vi.fn()
    const markAutoOpened = vi.fn()
    const Wrapper = buildWrapper({
      openSpy,
      seen: { hasSeenOnboarding: false, markAutoOpened },
    })

    render(
      <Wrapper>
        <Harness status="bootstrapping" />
      </Wrapper>,
    )

    expect(openSpy).not.toHaveBeenCalled()
    expect(markAutoOpened).not.toHaveBeenCalled()
  })

  it('does NOT re-open after manual close mid-flow on re-render', () => {
    const openSpy = vi.fn()
    const markAutoOpened = vi.fn()
    const Wrapper = buildWrapper({
      openSpy,
      seen: { hasSeenOnboarding: false, markAutoOpened },
    })

    const { rerender } = render(
      <Wrapper>
        <Harness status="bootstrapping" />
      </Wrapper>,
    )
    rerender(
      <Wrapper>
        <Harness status="incomplete" />
      </Wrapper>,
    )

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(markAutoOpened).toHaveBeenCalledTimes(1)

    // Subsequent re-renders at the same incomplete status — user has closed the
    // sheet — must NOT auto-open again within this mount.
    rerender(
      <Wrapper>
        <Harness status="incomplete" />
      </Wrapper>,
    )
    rerender(
      <Wrapper>
        <Harness status="incomplete" />
      </Wrapper>,
    )

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(markAutoOpened).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when the seen-store provider is not mounted', () => {
    const openSpy = vi.fn()
    const markAutoOpened = vi.fn()
    const Wrapper = buildWrapper({
      openSpy,
      seen: { hasSeenOnboarding: false, markAutoOpened, mounted: false },
    })

    const { rerender } = render(
      <Wrapper>
        <Harness status="bootstrapping" />
      </Wrapper>,
    )
    rerender(
      <Wrapper>
        <Harness status="incomplete" />
      </Wrapper>,
    )

    expect(openSpy).not.toHaveBeenCalled()
    expect(markAutoOpened).not.toHaveBeenCalled()
  })
})
