import { useCallback, useMemo, useState } from 'react'
import { VenueOnboardingSheetContext } from './venue-onboarding-sheet-provider.context'
import type {
  VenueOnboardingSheetContextValue,
  VenueOnboardingSheetProviderProps,
} from './venue-onboarding-sheet-provider.types'

/**
 * Owns the `{ isOpen, open, close }` controller for the venue-onboarding
 * sheet. Stateless beyond the open/close flag — opening logic lives at the
 * consumer (e.g. auto-open on L2 in app/, manual open via banner/gate button).
 */
export function VenueOnboardingSheetProvider({
  children,
  defaultOpen = false,
}: VenueOnboardingSheetProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo<VenueOnboardingSheetContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  )
  return (
    <VenueOnboardingSheetContext.Provider value={value}>
      {children}
    </VenueOnboardingSheetContext.Provider>
  )
}
