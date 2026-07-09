import type { ManageFundsPill } from './manage-funds-pills.types'

/**
 * Header pill order — matches the reference: Perps⇄Spot, EVM⇄Core, Send,
 * Deposit, Withdraw. Distinct from the modal's nav-rail order (which leads with
 * Deposit); the pill row is a quick-launch header bar, each pill deep-links its
 * tab via `useManageFunds().open(tab)`.
 */
export const MANAGE_FUNDS_PILLS: ReadonlyArray<ManageFundsPill> = [
  { id: 'transfer', label: 'Perps⇄Spot' },
  { id: 'evm-core', label: 'EVM⇄Core' },
  { id: 'send', label: 'Send' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdraw', label: 'Withdraw' },
] as const

// Shown when a pill / the Simple-mode button is tapped while spectating (Manage
// Funds always acts on the connected wallet, never the spectated one — mirrors
// trade-equity-card's ADR-0072 guard).
export const SPECTATE_FUNDS_TOAST_TITLE = 'Spectate mode'
export const SPECTATE_FUNDS_TOAST_DESCRIPTION =
  'Manage Funds is not available while spectating.'
