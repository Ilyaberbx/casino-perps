import type { FC, ReactNode } from 'react'
import type { SheetSide } from '../Sheet'

export interface DepositSheetContent {
  readonly isOpen: boolean
  close(): void
  readonly side: SheetSide
  /**
   * The active venue's deposit chrome — `provider` wraps `Body`. `null` when the
   * active venue has no `deposit` capability (the sheet then renders nothing).
   */
  readonly capability: DepositSheetCapabilityView | null
}

export interface DepositSheetCapabilityView {
  readonly Provider: FC<{ children: ReactNode }>
  readonly Body: FC
}
