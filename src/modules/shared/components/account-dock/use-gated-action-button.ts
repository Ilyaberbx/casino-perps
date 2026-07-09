import { useCallback } from 'react'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { useIsVenueCapabilityReady } from '@/modules/shared/hooks/use-is-venue-capability-ready'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'

/**
 * Smart-hook for the {@link GatedActionButton}. Reads the venue
 * `sign-actions` capability predicate (#163) and the mobile media-query;
 * exposes a derived state the dumb component renders straight to DOM.
 *
 * Behaviour (per Slice 8/12 of `.design/hyperliquid-onboarding`):
 * - predicate `true`  → button enabled, calls `onClick`.
 * - predicate `false` → button disabled.
 *   - desktop: hover tooltip + info-icon (click → open sheet).
 *   - mobile : tap on disabled button opens the sheet directly.
 */
export interface UseGatedActionButtonOptions {
  readonly onClick: () => void
}

export interface UseGatedActionButtonReturn {
  readonly isReady: boolean
  readonly isMobile: boolean
  readonly handleButtonClick: () => void
  readonly handleInfoIconClick: () => void
}

export function useGatedActionButton({
  onClick,
}: UseGatedActionButtonOptions): UseGatedActionButtonReturn {
  const isReady = useIsVenueCapabilityReady('sign-actions')
  const isMobile = useIsMobile()
  const { open: openSheet } = useVenueOnboardingSheet()

  const handleButtonClick = useCallback(() => {
    if (isReady) {
      onClick()
      return
    }
    if (isMobile) openSheet()
  }, [isReady, isMobile, onClick, openSheet])

  const handleInfoIconClick = useCallback(() => {
    openSheet()
  }, [openSheet])

  return { isReady, isMobile, handleButtonClick, handleInfoIconClick }
}
