import type { ManageFundsTab } from './manage-funds-provider.types'

/**
 * Canonical nav-rail order + labels for the Manage Funds tabs. The pane and nav
 * iterate this; the pill row keys its own order off these ids (see
 * `manage-funds-pills.constants.ts`). `transfer` is the Perps⇄Spot tab and
 * `evm-core` is the EVM⇄Core tab.
 */
export const MANAGE_FUNDS_TABS: ReadonlyArray<{
  readonly id: ManageFundsTab
  readonly label: string
}> = [
  { id: 'deposit', label: 'Deposit' },
  { id: 'transfer', label: 'Perps⇄Spot' },
  { id: 'send', label: 'Send' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'evm-core', label: 'EVM⇄Core' },
] as const

export const DEFAULT_MANAGE_FUNDS_TAB: ManageFundsTab = 'deposit'

/**
 * Label of the single Simple-mode button that collapses the multi-action funding
 * affordance (the pill row in the header, the three funding actions in the trade
 * equity card) to one "Manage Funds" button opening the modal on the default tab.
 * Shared by `manage-funds-pills` and `trade-equity-card` (#272, #278).
 */
export const MANAGE_FUNDS_SINGLE_LABEL = 'Manage Funds'
