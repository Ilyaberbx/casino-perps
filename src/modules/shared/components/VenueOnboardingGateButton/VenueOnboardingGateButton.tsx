import { useVenueOnboardingGateButton } from './use-venue-onboarding-gate-button'
import styles from './venue-onboarding-gate-button.module.css'
import type { VenueOnboardingGateButtonProps } from './venue-onboarding-gate-button.types'

/**
 * Wraps a feature submit button. Renders:
 * - children when the venue onboarding is `ready` (or absent),
 * - a disabled "Checking…" button with spinner during `bootstrapping`,
 * - a "Complete {venueLabel} Setup" button that opens the onboarding sheet
 *   otherwise (incomplete / error states).
 *
 * Mirrors `<ConnectWalletGateButton>` (mode-3 of `wallet-gate.md`) for
 * onboarding (mode-4). See ADR-0026.
 */
export function VenueOnboardingGateButton({ children }: VenueOnboardingGateButtonProps) {
  const state = useVenueOnboardingGateButton()

  if (state.kind === 'ready') return <>{children}</>

  if (state.kind === 'bootstrapping') {
    return (
      <button type="button" className={styles.button} disabled aria-busy="true">
        <span className={styles.spinner} aria-hidden="true" />
        Checking…
      </button>
    )
  }

  return (
    <button type="button" className={styles.button} onClick={state.onClick}>
      {state.label}
    </button>
  )
}
