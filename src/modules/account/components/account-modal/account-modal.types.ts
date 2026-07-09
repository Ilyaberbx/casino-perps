import type { RefObject } from 'react'
import type { WalletSource } from '../../domain/types'

export type AccountSection = 'profile' | 'mfa' | 'wallets'

export interface AccountNavItem {
  readonly id: AccountSection
  readonly label: string
}

export interface AccountModalView {
  readonly isOpen: boolean
  readonly isMobile: boolean
  readonly activeSection: AccountSection
  readonly navItems: ReadonlyArray<AccountNavItem>
  onClose(): void
  onSelectSection(section: AccountSection): void
}

export interface AccountModalNavProps {
  readonly isMobile: boolean
  readonly activeSection: AccountSection
  readonly navItems: ReadonlyArray<AccountNavItem>
  onSelectSection(section: AccountSection): void
}

export interface ProfileSectionView {
  readonly email: string
  readonly handle: string
  readonly nativeAddress: string
  readonly iconUrl: string | null
  onLogout(): void
}

export type MfaSectionView =
  | { kind: 'unset'; isEnrolling: boolean; onSetup(): void }
  | { kind: 'set' }

/** A single user-wallet row in the Wallets section (PRD-0006 UI-5). */
export interface WalletRowView {
  readonly address: string
  readonly truncatedAddress: string
  readonly source: WalletSource
  /** Display label: `Native` for the embedded wallet, `Imported` otherwise. */
  readonly sourceLabel: string
  readonly isSelected: boolean
  /** The Native (embedded) wallet has no Remove action (slice 06). */
  readonly isNative: boolean
  /** Imported (`external`) wallets expose a Remove action; Native/Agent do not. */
  readonly isRemovable: boolean
  /**
   * Whether this wallet's private key is owner-exportable (ADR-0076 D-5): `true`
   * for `embedded` + `imported` provenance that Privy holds key material for AND
   * that is present in `exportableAddresses` (the live runtime guard). Link-only
   * `external` wallets are `false` — their menu shows a non-export note instead.
   */
  readonly isExportable: boolean
  /**
   * Best-effort connector brand icon URL for an imported wallet, resolved from
   * the live Privy connector / `walletClientType`. `null` ⇒ fall back to the
   * deterministic `Web3Avatar` gradient (Native rows are always `null`).
   */
  readonly connectorIconUrl: string | null
}

/** The read-only, uncounted Agent Wallet row (G-6). */
export interface AgentWalletRowView {
  /** `null` until the agent-wallet address resolves. */
  readonly truncatedAddress: string | null
  /** Live Agent Balance (USDC), pre-formatted (`$0.00` when empty/disconnected). */
  readonly balanceDisplay: string
  /**
   * Whether the Agent Wallet is owner-exportable right now (ADR-0076 D-5): `true`
   * iff its address is in `exportableAddresses` — i.e. the Agent Wallet has been
   * migrated to user-owned and is a Privy-managed wallet. Stays `false` (export
   * affordance disabled) while it is still app-owned.
   */
  readonly isExportable: boolean
  /** MFA-gated owner-only export of the Agent Wallet's private key. */
  onExport(): void
}

export interface WalletsSectionView {
  /** `false` until the onboarding flow resolves `Me` — the section renders nothing. */
  readonly isReady: boolean
  readonly rows: ReadonlyArray<WalletRowView>
  /** User-wallet count — the Agent row is **not** counted toward the cap (G-6). */
  readonly walletCount: number
  readonly walletCap: number
  /** Number of **imported** (`external`) wallets — Native + Agent excluded (UI-5). */
  readonly importedCount: number
  /** Max imported (`external`) wallets a user may hold (UI-5 cap = 3). */
  readonly importCap: number
  /** `true` at the imported-wallet cap — the Import button is disabled. */
  readonly isImportAtCap: boolean
  /** A short cap hint, e.g. `3/3 imported`, shown next to a disabled button. */
  readonly importHint: string
  /** `true` while a link→import round-trip is in flight (button shows pending). */
  readonly isImporting: boolean
  readonly agent: AgentWalletRowView
  onSelect(address: string): void
  /** Opens Privy `linkWallet` → `POST /api/account/wallets/import` (UI-5). */
  onImport(): void
  /** `DELETE /api/account/wallets/:address` after a confirm (imported-only). */
  onRemove(address: string): void
}

/** Open/close state + actions for a wallet row's overflow (⋮) menu (UI-5). */
export interface WalletRowMenuView {
  readonly isOpen: boolean
  /** Positions the shared `Popover` dropdown against the trigger (ADR-0037). */
  readonly anchorRef: RefObject<HTMLButtonElement | null>
  readonly panelRef: RefObject<HTMLDivElement | null>
  onToggle(): void
  onCopy(): void
  /** Confirms, then removes the wallet via `onRemove` (imported-only — slice 06). */
  onRemove(): void
  /** Closes the menu, then runs the MFA-gated owner-only export (ADR-0076 D-5). */
  onExport(): void
}

export interface WalletRowMenuProps {
  readonly address: string
  /** Imported wallets show a Remove item; Native/Agent pass `false`. */
  readonly isRemovable: boolean
  /**
   * Owner-exportable wallets show an `Export private key` item; link-only
   * `external` wallets pass `false` and show a non-export note (ADR-0076 D-5).
   */
  readonly isExportable: boolean
  onRemove(address: string): void
}

export interface WalletRowProps {
  readonly row: WalletRowView
  onSelect(address: string): void
  onRemove(address: string): void
}

export interface AgentWalletRowProps {
  readonly agent: AgentWalletRowView
}

/**
 * One per-DEX equity line for the Selected Wallet (PRD-0006 UI-5). Iterates the
 * integrated venues (no hardcoded Hyperliquid); a venue the wallet isn't
 * onboarded on (or unreadable) reads `$0` with an Onboard link (G-10 — never an
 * error). Display-only (no deposit deep-link).
 */
export interface SelectedWalletVenueBalanceView {
  /** The integrated venue id (stable key). */
  readonly venueId: string
  /** The venue label (rendered alongside its monogram). */
  readonly venueLabel: string
  /** Pre-formatted Total Account Value (equity); `$0` when not onboarded/unreadable. */
  readonly equityDisplay: string
  /** `true` when the venue gates trading and the Selected Wallet isn't onboarded. */
  readonly isOnboardingRequired: boolean
  /** Opens the existing venue-onboarding sheet for the Selected Wallet. */
  onOnboard(): void
}

export interface SelectedWalletBalancesView {
  /** One line per integrated venue (empty when no venue is active). */
  readonly venues: ReadonlyArray<SelectedWalletVenueBalanceView>
}
