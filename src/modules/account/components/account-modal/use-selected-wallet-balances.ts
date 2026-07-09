import { useEffect, useMemo, useRef, useState } from 'react'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import { useIsVenueOnboardingReady } from '@/modules/shared/hooks/use-is-venue-onboarding-ready'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { formatUsd } from '@/modules/shared/utils/format-number'
import type {
  SelectedWalletBalancesView,
  SelectedWalletVenueBalanceView,
} from './account-modal.types'

/**
 * Drives the per-DEX balance panel under the Selected Wallet row (PRD-0006
 * UI-5). It **iterates the integrated venues** — read from the active
 * `VenueProvider`, never a hardcoded Hyperliquid (only HL is integrated today,
 * so the list is one venue) — and surfaces each venue's **Total Account Value
 * (equity)** from its `portfolio` reader (`'all'` scope = net worth).
 *
 * G-10 — a venue the Selected Wallet isn't onboarded on (the venue gates trading
 * and `useIsVenueOnboardingReady()` is false), or one with no readable portfolio
 * capability, reads **`$0`** with an Onboard link opening the existing
 * `VenueOnboardingSheet`. It is **never** an error. Display-only — no deposit
 * deep-link. The agent/builder/deposit re-key (slice 07) keys the readiness
 * predicate to the Selected Wallet, so this reflects the Selected Wallet.
 */
export function useSelectedWalletBalances(): SelectedWalletBalancesView {
  // The integrated venue(s) — read from the active VenueProvider, which the
  // Account Modal always mounts under (AppShell). Only HL is integrated today,
  // so the list is one venue; this never hardcodes Hyperliquid.
  const venue = useVenue()
  const isVenueOnboardingReady = useIsVenueOnboardingReady()
  const onboardingSheet = useVenueOnboardingSheet()

  // The live equity (Total Account Value) for the active venue. `null` until the
  // first snapshot lands or when the venue has no readable portfolio capability.
  const [equity, setEquity] = useState<number | null>(null)

  const portfolio = venue.capabilities.portfolio ?? null
  const hasPortfolio = portfolio !== null
  // Key the resubscribe/reset on the STABLE venue identity (`metadata.id`) plus a
  // `hasPortfolio` boolean — NOT on the `portfolio` reader reference. A genuine
  // selected-wallet/venue change rebuilds the venue (new `metadata.id`), so the
  // reset + resubscribe still fire then; but a re-render that hands down a fresh
  // venue object of the SAME id (same capabilities, new identity) no longer
  // triggers a spurious equity reset → `$0` flash → teardown+resubscribe.
  const subscriptionKey = `${venue.metadata.id}:${hasPortfolio}`
  // Hold the live `portfolio` reader in a ref so the subscription effect can
  // resolve it at subscribe time without listing it as a dependency — its
  // reference is incidental, the venue identity is what matters. The ref is
  // synced in an effect (never during render, per react-hooks/refs) placed
  // ABOVE the subscription effect so on a key-changing render the fresh reader
  // is already in the ref when the keyed effect re-subscribes.
  const portfolioRef = useRef(portfolio)
  useEffect(() => {
    portfolioRef.current = portfolio
  })

  // Reset the equity when the venue identity / portfolio presence changes —
  // during render via the converger idiom (React 19 / React Compiler bans
  // setState-in-effect). The subscription effect below only setStates from the
  // async snapshot callback.
  const [convergedKey, setConvergedKey] = useState(subscriptionKey)
  if (subscriptionKey !== convergedKey) {
    setConvergedKey(subscriptionKey)
    setEquity(null)
  }
  useEffect(() => {
    const reader = portfolioRef.current
    if (!reader) return
    return reader.subscribeSnapshot('all', (snapshot) => setEquity(snapshot.accountValue))
    // Keyed on the stable subscription key, not the reader reference (read via
    // ref). `subscriptionKey` already encodes both `metadata.id` and
    // `hasPortfolio`, so a new venue object of the same id does not resubscribe.
  }, [subscriptionKey])

  const venues = useMemo<ReadonlyArray<SelectedWalletVenueBalanceView>>(() => {
    const isOnboardingRequired = !isVenueOnboardingReady
    // G-10: not onboarded OR unreadable → $0, never an error.
    const isReadable = portfolio !== null && isVenueOnboardingReady && equity !== null
    const equityDisplay = isReadable ? formatUsd(equity) : formatUsd(0)
    return [
      {
        venueId: venue.metadata.id,
        venueLabel: venue.metadata.label,
        equityDisplay,
        isOnboardingRequired,
        onOnboard: () => onboardingSheet.open(),
      },
    ]
  }, [venue.metadata, portfolio, isVenueOnboardingReady, equity, onboardingSheet])

  return { venues }
}
