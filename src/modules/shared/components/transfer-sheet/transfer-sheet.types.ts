import type { FC, ReactNode } from 'react'
import type { SheetSide } from '../Sheet'

export interface TransferSheetContent {
  readonly isOpen: boolean
  close(): void
  readonly side: SheetSide
  /**
   * The active venue's transfer chrome — `Provider` wraps `Body`, plus the
   * port's `useTransfer` so the inner gate can read `isApplicable`. `null` when
   * the active venue has no `transfer` capability (the sheet then renders
   * nothing).
   */
  readonly capability: TransferSheetCapabilityView | null
}

export interface TransferSheetCapabilityView {
  readonly Provider: FC<{ children: ReactNode }>
  readonly Body: FC
  useTransfer(): { readonly isApplicable: boolean }
}

export interface ApplicableGateProps {
  useTransfer(): { readonly isApplicable: boolean }
  readonly Body: FC
}
