import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { imperativeToastQueue } from '@/modules/shared/services/toast'
import type { ToastPayload, ToastQueueEvent } from '@/modules/shared/services/toast'
import { resetImperativeToastQueue } from '@/modules/shared/services/toast/__fixtures__/reset-imperative-toast-queue'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { VenueOnboardingSheetContext } from '@/modules/shared/providers/venue-onboarding-sheet-provider/venue-onboarding-sheet-provider.context'
import { buildFakeVenueOnboarding } from '@/modules/shared/components/VenueOnboardingSheet/__fixtures__/fake-venue-onboarding'
import type {
  VenueOnboarding,
  VenueOnboardingStatus,
} from '@/modules/shared/domain'
import { useOnboardingCompletionEffect } from '../use-onboarding-completion-effect'

function Harness({
  status,
  venueLabel,
}: {
  readonly status: VenueOnboardingStatus
  readonly venueLabel: string
}) {
  const onboarding: VenueOnboarding = buildFakeVenueOnboarding({ status, venueLabel })
  useOnboardingCompletionEffect(onboarding)
  return null
}

function captureToasts(): ToastPayload[] {
  const captured: ToastPayload[] = []
  imperativeToastQueue.subscribe((event: ToastQueueEvent) => {
    if (event.kind !== 'show') return
    captured.push({
      variant: event.record.variant,
      title: event.record.title,
      description: event.record.description,
      durationMs: event.record.durationMs,
      action: event.record.action,
    })
  })
  return captured
}

describe('useOnboardingCompletionEffect', () => {
  beforeEach(() => {
    resetImperativeToastQueue()
  })
  afterEach(() => {
    resetImperativeToastQueue()
  })

  it('fires success toast and closes sheet on incomplete → ready transition', () => {
    const captured = captureToasts()
    const closeSpy = vi.fn()

    function SheetController({ children }: { readonly children: ReactNode }) {
      return (
        <VenueOnboardingSheetContext.Provider
          value={{ isOpen: true, open: () => {}, close: closeSpy }}
        >
          {children}
        </VenueOnboardingSheetContext.Provider>
      )
    }

    const { rerender } = render(
      <SheetController>
        <Harness status="incomplete" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    expect(captured).toHaveLength(0)
    expect(closeSpy).not.toHaveBeenCalled()

    rerender(
      <SheetController>
        <Harness status="ready" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      variant: 'success',
      title: 'Hyperliquid setup complete',
      description: 'You can now trade.',
    })
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('does NOT re-fire on ready → ready re-render', () => {
    const captured = captureToasts()
    const closeSpy = vi.fn()

    function SheetController({ children }: { readonly children: ReactNode }) {
      return (
        <VenueOnboardingSheetContext.Provider
          value={{ isOpen: false, open: () => {}, close: closeSpy }}
        >
          {children}
        </VenueOnboardingSheetContext.Provider>
      )
    }

    const { rerender } = render(
      <SheetController>
        <Harness status="incomplete" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    rerender(
      <SheetController>
        <Harness status="ready" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    expect(captured).toHaveLength(1)
    expect(closeSpy).toHaveBeenCalledTimes(1)

    rerender(
      <SheetController>
        <Harness status="ready" venueLabel="Hyperliquid" />
      </SheetController>,
    )
    rerender(
      <SheetController>
        <Harness status="ready" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    expect(captured).toHaveLength(1)
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('fires toast even when sheet is closed mid-signing', () => {
    const captured = captureToasts()
    const closeSpy = vi.fn()

    function SheetController({ children }: { readonly children: ReactNode }) {
      return (
        <VenueOnboardingSheetContext.Provider
          value={{ isOpen: false, open: () => {}, close: closeSpy }}
        >
          {children}
        </VenueOnboardingSheetContext.Provider>
      )
    }

    const { rerender } = render(
      <SheetController>
        <Harness status="incomplete" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    rerender(
      <SheetController>
        <Harness status="ready" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      variant: 'success',
      title: 'Hyperliquid setup complete',
      description: 'You can now trade.',
    })
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire on bootstrapping → ready (already-onboarded reload)', () => {
    const captured = captureToasts()
    const closeSpy = vi.fn()

    function SheetController({ children }: { readonly children: ReactNode }) {
      return (
        <VenueOnboardingSheetContext.Provider
          value={{ isOpen: false, open: () => {}, close: closeSpy }}
        >
          {children}
        </VenueOnboardingSheetContext.Provider>
      )
    }

    const { rerender } = render(
      <SheetController>
        <Harness status="bootstrapping" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    rerender(
      <SheetController>
        <Harness status="ready" venueLabel="Hyperliquid" />
      </SheetController>,
    )

    expect(captured).toHaveLength(0)
    expect(closeSpy).not.toHaveBeenCalled()
  })

  it('interpolates the venue label provided by the onboarding port', () => {
    const captured = captureToasts()

    function Controlled() {
      const [status, setStatus] = useState<VenueOnboardingStatus>('incomplete')
      return (
        <>
          <button type="button" onClick={() => setStatus('ready')}>
            flip
          </button>
          <Harness status={status} venueLabel="FutureVenue" />
        </>
      )
    }

    const { getByText } = render(
      <VenueOnboardingSheetProvider>
        <Controlled />
      </VenueOnboardingSheetProvider>,
    )

    act(() => {
      getByText('flip').click()
    })

    expect(captured).toHaveLength(1)
    expect(captured[0]?.title).toBe('FutureVenue setup complete')
  })
})
