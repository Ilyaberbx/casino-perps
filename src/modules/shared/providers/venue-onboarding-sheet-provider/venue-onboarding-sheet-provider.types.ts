import type { ReactNode } from 'react'

export interface VenueOnboardingSheetContextValue {
  readonly isOpen: boolean
  open(): void
  close(): void
}

export interface VenueOnboardingSheetProviderProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
}
