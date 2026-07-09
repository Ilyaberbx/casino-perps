import type { RefObject } from 'react'
import type { WalletSource } from '../../domain/types'

/** One selectable wallet in the header Quick-Wallet Switcher. */
export interface QuickWalletItem {
  readonly value: string
  /** `Native` for the embedded wallet, a truncated address for imported. */
  readonly label: string
  readonly address: string
  readonly source: WalletSource
}

export interface QuickWalletSwitcherView {
  /** `false` until the onboarding flow resolves `Me` — the switcher renders nothing. */
  readonly isReady: boolean
  /** The wallet shown in the trigger (the Selected Wallet); `null` when no wallets. */
  readonly triggerItem: QuickWalletItem | null
  readonly items: ReadonlyArray<QuickWalletItem>
  /** The Selected Wallet address (optimistic), used to mark the active row. */
  readonly value: string
  readonly isOpen: boolean
  /** Collapse the trigger to an avatar-only chip in the condensed header. */
  readonly isCompact: boolean
  readonly isImporting: boolean
  readonly isImportAtCap: boolean
  readonly importHint: string
  readonly anchorRef: RefObject<HTMLButtonElement | null>
  readonly panelRef: RefObject<HTMLDivElement | null>
  onToggle(): void
  onSelectWallet(address: string): void
  onImport(): void
}

export interface WalletSwitcherMenuProps {
  readonly items: ReadonlyArray<QuickWalletItem>
  readonly value: string
  readonly isImporting: boolean
  readonly isImportAtCap: boolean
  readonly importHint: string
  onSelectWallet(address: string): void
  onImport(): void
}
