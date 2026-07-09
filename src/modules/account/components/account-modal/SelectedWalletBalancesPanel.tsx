import { VenueIcon } from '@/modules/shared/components/venue-icon'
import { useSelectedWalletBalances } from './use-selected-wallet-balances'
import styles from './account-modal.module.css'
import type { SelectedWalletVenueBalanceView } from './account-modal.types'

const VENUE_ICON_SIZE = 24

/**
 * The per-DEX balance panel under the Selected Wallet row (PRD-0006 UI-5). One
 * line per integrated venue: a monogram + label + the wallet's Total Account
 * Value (equity). A venue the wallet isn't onboarded on reads `$0` with an
 * Onboard link opening the existing venue-onboarding sheet (G-10). Display-only.
 * A self-contained sub-feature: it owns its `useSelectedWalletBalances` hook so
 * the parent `WalletsSection` keeps a single feature hook.
 */
export function SelectedWalletBalancesPanel() {
  const view = useSelectedWalletBalances()
  if (view.venues.length === 0) return null

  return (
    <div className={styles.venueBalances} data-testid="selected-wallet-balances">
      <span className={styles.venueBalanceHeading}>Balances by DEX</span>
      {view.venues.map((venue) => (
        <VenueBalanceRow key={venue.venueId} venue={venue} />
      ))}
    </div>
  )
}

function VenueBalanceRow({ venue }: { venue: SelectedWalletVenueBalanceView }) {
  return (
    <div className={styles.venueBalanceRow} data-testid={`venue-balance-${venue.venueId}`}>
      <VenueIcon venueId={venue.venueId} label={venue.venueLabel} size={VENUE_ICON_SIZE} />
      <span className={styles.venueBalanceLabel}>{venue.venueLabel}</span>
      {venue.isOnboardingRequired ? (
        <button
          type="button"
          className={styles.venueOnboardLink}
          data-testid={`venue-onboard-${venue.venueId}`}
          onClick={venue.onOnboard}
        >
          Not onboarded — Onboard
        </button>
      ) : (
        <span className={styles.venueBalanceValue}>{venue.equityDisplay}</span>
      )}
    </div>
  )
}
