import type { ReactNode } from 'react'

/**
 * The five tabs of the Manage Funds modal, in canonical order. `transfer` is the
 * Perps⇄Spot tab and `evm-core` is the EVM⇄Core tab — the union keys the active
 * pane, the nav rail, and the deep-link triggers.
 */
export type ManageFundsTab = 'deposit' | 'transfer' | 'send' | 'withdraw' | 'evm-core'

export interface ManageFundsContextValue {
  readonly isOpen: boolean
  readonly activeTab: ManageFundsTab
  /** Opens the modal on the given tab (sets `activeTab` then `isOpen = true`). */
  open(tab: ManageFundsTab): void
  close(): void
  setActiveTab(tab: ManageFundsTab): void
}

export interface ManageFundsProviderProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
  readonly defaultTab?: ManageFundsTab
}
