import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Repeat,
  Send,
} from 'lucide-react'
import type { FC } from 'react'
import type { ManageFundsTab } from '../../providers/manage-funds-provider'

export const MANAGE_FUNDS_MODAL_TITLE = 'Manage Funds'
export const MANAGE_FUNDS_MODAL_ARIA_LABEL = 'Manage funds'

/** lucide icon per tab. Acronym casing preserved in labels (EVM⇄Core). */
export const MANAGE_FUNDS_TAB_ICONS: Record<ManageFundsTab, FC<{ size?: number }>> = {
  deposit: ArrowDownToLine,
  transfer: ArrowLeftRight,
  send: Send,
  withdraw: ArrowUpFromLine,
  'evm-core': Repeat,
}

/** Copy when a venue does not expose a capability the tab needs. */
export const UNSUPPORTED_COPY = 'This action is not available for the current venue.'
