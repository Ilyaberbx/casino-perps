import type { FC, ReactNode } from 'react'
import type { ManageFundsTab } from '../../providers/manage-funds-provider'

/**
 * The active venue's deposit/withdraw chrome — `Provider` wraps `Body`. Shared
 * shape across the deposit and withdraw capabilities (both Option-A bodies the
 * host mounts opaquely). `null` when the active venue has no such capability.
 */
export interface CapabilityView {
  readonly Provider: FC<{ children: ReactNode }>
  readonly Body: FC
}

/**
 * The transfer capability adds `useTransfer` so the inner `ApplicableGate` can
 * read `isApplicable` from inside the mounted provider (mirrors `TransferSheet`).
 */
export interface TransferCapabilityView extends CapabilityView {
  useTransfer(): { readonly isApplicable: boolean }
}

/** One nav entry: id, label, icon, and whether the venue can service it today. */
export interface ManageFundsNavTab {
  readonly id: ManageFundsTab
  readonly label: string
  readonly Icon: FC<{ size?: number }>
  /**
   * `true` when the active tab can render a real body — i.e. the active venue
   * exposes the matching capability. Tabs whose capability is absent render an
   * unsupported note.
   */
  readonly isAvailable: boolean
}

export interface ManageFundsModalContent {
  readonly isOpen: boolean
  readonly activeTab: ManageFundsTab
  close(): void
  onSelectTab(tab: ManageFundsTab): void
  readonly tabs: ReadonlyArray<ManageFundsNavTab>
  readonly isMobile: boolean
  readonly deposit: CapabilityView | null
  readonly transfer: TransferCapabilityView | null
  readonly withdraw: CapabilityView | null
  readonly send: CapabilityView | null
  readonly evmCore: CapabilityView | null
}

export interface ManageFundsNavProps {
  readonly tabs: ReadonlyArray<ManageFundsNavTab>
  readonly activeTab: ManageFundsTab
  onSelect(tab: ManageFundsTab): void
  readonly isMobile: boolean
}

export interface ManageFundsPaneProps {
  readonly activeTab: ManageFundsTab
  readonly deposit: CapabilityView | null
  readonly transfer: TransferCapabilityView | null
  readonly withdraw: CapabilityView | null
  readonly send: CapabilityView | null
  readonly evmCore: CapabilityView | null
}

export interface ApplicableGateProps {
  useTransfer(): { readonly isApplicable: boolean }
  readonly Body: FC
}
