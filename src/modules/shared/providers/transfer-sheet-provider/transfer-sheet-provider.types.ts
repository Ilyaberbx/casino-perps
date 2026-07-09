import type { ReactNode } from 'react'

/** Which account the transfer should start *from* when the sheet opens. */
export type TransferFromAccount = 'spot' | 'perps'

/** Optional opening hint — the per-row balances button (slice 05) sets `from`. */
export interface TransferPrefill {
  readonly from: TransferFromAccount
}

export interface TransferSheetContextValue {
  readonly isOpen: boolean
  /**
   * The prefill the sheet was last opened with, or `null` when opened with no
   * hint (default direction Spot→Perp). The venue body reads this to seed its
   * From/To selectors on open.
   */
  readonly prefill: TransferPrefill | null
  open(prefill?: TransferPrefill): void
  close(): void
}

export interface TransferSheetProviderProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
}
