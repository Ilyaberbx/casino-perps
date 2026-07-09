import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import {
  makeVenueOnboarding,
  makeOnboardingStep,
} from '@/modules/shared/hooks/__fixtures__/venue-onboarding'
import type {
  PortfolioReader,
  PortfolioSnapshot,
  Unsubscribe,
  Venue,
} from '@/modules/shared/domain'
import { useSelectedWalletBalances } from '../use-selected-wallet-balances'

function makePortfolioReader(accountValue: number): PortfolioReader {
  return {
    subscribeSnapshot(_scope, onUpdate): Unsubscribe {
      const snapshot = {
        accountValue,
        pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
        perpsPnl: 0,
        volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
        spotEquity: 0,
        perpsEquity: accountValue,
        fourteenDayVolume: 0,
        timestamp: Date.now(),
      } as PortfolioSnapshot
      onUpdate(snapshot)
      return () => undefined
    },
    getHistory() {
      throw new Error('not used')
    },
  } as PortfolioReader
}

interface MakeVenueOptions {
  readonly id?: string
  readonly label?: string
  readonly accountValue?: number
  readonly hasPortfolio?: boolean
  readonly onboardingReady?: boolean
}

function makeVenue(options: MakeVenueOptions = {}): Venue {
  const onboarding =
    options.onboardingReady === undefined
      ? undefined
      : makeVenueOnboarding({
          status: options.onboardingReady ? 'ready' : 'incomplete',
          steps: [makeOnboardingStep({ status: options.onboardingReady ? 'complete' : 'pending' })],
        })
  return {
    metadata: { id: options.id ?? 'hyperliquid', label: options.label ?? 'Hyperliquid' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      ...(options.hasPortfolio === false
        ? {}
        : { portfolio: makePortfolioReader(options.accountValue ?? 0) }),
    },
    onboarding: onboarding
      ? {
          provider: ({ children }: { children: ReactNode }) => <>{children}</>,
          useVenueOnboarding: () => onboarding,
        }
      : undefined,
  } as Venue
}

function makeWrapper(venue: Venue | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const inner = (
      <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
    )
    return venue ? <VenueProvider venue={venue}>{inner}</VenueProvider> : inner
  }
}

function useProbe() {
  return {
    balances: useSelectedWalletBalances(),
    onboardingSheet: useVenueOnboardingSheet(),
  }
}

describe('useSelectedWalletBalances (per-DEX balance, UI-5 / slice 07)', () => {
  it('iterates the integrated venue(s) — one line per venue, not hardcoded', async () => {
    const { result } = renderHook(() => useSelectedWalletBalances(), {
      wrapper: makeWrapper(makeVenue({ id: 'hyperliquid', label: 'Hyperliquid', onboardingReady: true, accountValue: 1234 })),
    })
    await waitFor(() => expect(result.current.venues).toHaveLength(1))
    expect(result.current.venues[0].venueId).toBe('hyperliquid')
    expect(result.current.venues[0].venueLabel).toBe('Hyperliquid')
  })

  it('shows the Total Account Value (equity) for an onboarded venue', async () => {
    const { result } = renderHook(() => useSelectedWalletBalances(), {
      wrapper: makeWrapper(makeVenue({ onboardingReady: true, accountValue: 1234.5 })),
    })
    await waitFor(() => expect(result.current.venues[0].equityDisplay).toBe('$1,234.50'))
    expect(result.current.venues[0].isOnboardingRequired).toBe(false)
  })

  it('reads $0 + Onboard for a venue the wallet is NOT onboarded on (no error)', async () => {
    const { result } = renderHook(() => useSelectedWalletBalances(), {
      wrapper: makeWrapper(makeVenue({ onboardingReady: false, accountValue: 999 })),
    })
    await waitFor(() => expect(result.current.venues).toHaveLength(1))
    expect(result.current.venues[0].equityDisplay).toBe('$0.00')
    expect(result.current.venues[0].isOnboardingRequired).toBe(true)
  })

  it('reads $0 (not an error) for an unreadable venue with no portfolio capability', async () => {
    const { result } = renderHook(() => useSelectedWalletBalances(), {
      wrapper: makeWrapper(makeVenue({ hasPortfolio: false, onboardingReady: true })),
    })
    await waitFor(() => expect(result.current.venues).toHaveLength(1))
    expect(result.current.venues[0].equityDisplay).toBe('$0.00')
  })

  it('Onboard opens the existing venue-onboarding sheet', async () => {
    const { result } = renderHook(() => useProbe(), {
      wrapper: makeWrapper(makeVenue({ onboardingReady: false })),
    })
    await waitFor(() => expect(result.current.balances.venues).toHaveLength(1))
    act(() => result.current.balances.venues[0].onOnboard())
    expect(result.current.onboardingSheet.isOpen).toBe(true)
  })

  it('iterates whatever venue is active — not hardcoded to Hyperliquid', async () => {
    const { result } = renderHook(() => useSelectedWalletBalances(), {
      wrapper: makeWrapper(makeVenue({ id: 'mock', label: 'Mock', onboardingReady: true, accountValue: 50 })),
    })
    await waitFor(() => expect(result.current.venues).toHaveLength(1))
    expect(result.current.venues[0].venueId).toBe('mock')
    expect(result.current.venues[0].venueLabel).toBe('Mock')
  })

  it('does NOT resubscribe when re-rendered with a new venue object of the SAME id', async () => {
    let subscribeCount = 0
    // A portfolio reader factory that counts subscriptions. Each venue object
    // gets a FRESH reader reference — the realistic "capabilities rebuilt on a
    // venue re-render" shape. A reference-keyed effect would resubscribe on the
    // new reader; the id-keyed effect must not.
    function makeCountingPortfolio(): PortfolioReader {
      return {
        subscribeSnapshot(_scope, onUpdate): Unsubscribe {
          subscribeCount += 1
          onUpdate({
            accountValue: 4242,
            pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
            perpsPnl: 0,
            volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
            spotEquity: 0,
            perpsEquity: 4242,
            fourteenDayVolume: 0,
            timestamp: Date.now(),
          } as PortfolioSnapshot)
          return () => undefined
        },
        getHistory() {
          throw new Error('not used')
        },
      } as PortfolioReader
    }

    // A fresh venue OBJECT each call — SAME id, fresh capabilities (new portfolio
    // reader reference). This is the venue-object churn the hardening must absorb.
    function makeVenueWithStablePortfolio(): Venue {
      const onboarding = makeVenueOnboarding({
        status: 'ready',
        steps: [makeOnboardingStep({ status: 'complete' })],
      })
      return {
        metadata: { id: 'hyperliquid', label: 'Hyperliquid' },
        capabilities: {
          connection: { status: () => 'connected', subscribe: () => () => {} },
          portfolio: makeCountingPortfolio(),
        },
        onboarding: {
          provider: ({ children }: { children: ReactNode }) => <>{children}</>,
          useVenueOnboarding: () => onboarding,
        },
      } as Venue
    }

    // The wrapper reads the CURRENT venue from this holder; mutate + rerender to
    // swap in a new venue object of the same id (renderHook wrappers do not take
    // per-render props).
    let currentVenue = makeVenueWithStablePortfolio()
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <VenueProvider venue={currentVenue}>
          <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
        </VenueProvider>
      )
    }

    const { result, rerender } = renderHook(() => useSelectedWalletBalances(), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.venues[0].equityDisplay).toBe('$4,242.00'))
    const subscribeCountAfterFirstRender = subscribeCount

    // Hand the hook a brand-new venue object of the SAME id. Pre-hardening this
    // re-keyed the effect on the new `portfolio` reference → reset + resubscribe.
    currentVenue = makeVenueWithStablePortfolio()
    rerender()

    expect(subscribeCount).toBe(subscribeCountAfterFirstRender)
    expect(result.current.venues[0].equityDisplay).toBe('$4,242.00')
  })
})
