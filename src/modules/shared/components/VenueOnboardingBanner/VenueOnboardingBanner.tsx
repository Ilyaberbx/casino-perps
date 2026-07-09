import { X } from 'lucide-react'
import { IconButton } from '@/modules/shared/components/icon-button'
import { useVenueOnboardingBanner } from './use-venue-onboarding-banner'
import styles from './venue-onboarding-banner.module.css'
import type { VenueOnboardingBannerProps } from './venue-onboarding-banner.types'

/**
 * Global banner for the active venue's onboarding state.
 *
 * Three states:
 * - hidden: wallet disconnected, no onboarding, bootstrapping, ready, or
 *   dismissed (the close button)
 * - incomplete: "{venueLabel} setup: N/M · Continue →"
 * - in-flight: "{venueLabel} setting up…" with spinner (only when the
 *   sheet is closed and a step is currently running)
 *
 * Clicking the main area opens the onboarding sheet; the trailing close (X)
 * dismisses the banner for the session. See ADR-0026.
 */
export function VenueOnboardingBanner(props: VenueOnboardingBannerProps) {
  const state = useVenueOnboardingBanner(props)

  if (state.kind === 'hidden') return null

  return (
    <div className={styles.banner}>
      <button type="button" className={styles.main} onClick={state.onClick}>
        {state.kind === 'in-flight' ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <span className={styles.message}>{state.message}</span>
          </>
        ) : (
          <>
            <span className={styles.message}>{state.message}</span>
            <span aria-hidden="true">·</span>
            <span className={styles.cta}>{state.ctaLabel}</span>
          </>
        )}
      </button>
      <IconButton
        icon={X}
        tone="ghost"
        ariaLabel="Dismiss setup banner"
        title="Dismiss"
        className={styles.close}
        onClick={state.onDismiss}
      />
    </div>
  )
}
