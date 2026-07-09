import type { AccountNavItem } from './account-modal.types'

export const ACCOUNT_NAV_ITEMS: ReadonlyArray<AccountNavItem> = [
  { id: 'profile', label: 'Profile' },
  { id: 'mfa', label: '2FA' },
  { id: 'wallets', label: 'Wallets' },
] as const

/**
 * Maximum number of **user** wallets (Native + up to 3 imported). The Agent
 * Wallet is read-only and **not** counted toward this cap (G-6).
 */
export const MAX_USER_WALLETS = 4

/**
 * Max **imported** (`external`) wallets a user may hold (UI-5 cap = 3). Native
 * + Agent are excluded. Mirrors the server's `MAX_IMPORTED_WALLETS`
 * (`apps/server/src/account/account.dto.ts`) — keep the two in lock-step.
 */
export const MAX_IMPORTED_WALLETS = 3

/**
 * Display labels per wallet provenance (ADR-0076 D-6). `external` is a link-only
 * wallet (MetaMask-by-address) — relabelled `Linked` to free `Imported` for the
 * raw-key `imported` provenance, which is the genuinely-imported, exportable kind.
 */
export const WALLET_SOURCE_LABEL = {
  embedded: 'Native',
  external: 'Linked',
  imported: 'Imported',
} as const

/**
 * Shown in a link-only (`external`) wallet's overflow menu in place of the
 * Export private key item — Privy holds no key for a wallet linked by address,
 * so there is nothing to export here (ADR-0076 D-5).
 */
export const NON_EXPORTABLE_NOTE =
  "This wallet's key lives in your own wallet app — neither we nor Privy hold it, so it can't be exported here."
