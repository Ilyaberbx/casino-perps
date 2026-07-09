import type { TransferAccount, TransferError } from '../../providers/transfer-flow-provider'

/**
 * Copy + a11y constants for the HL transfer body. Pixel font for labels/buttons,
 * mono font for numbers (font-zoning). Centralised so the sub-components stay
 * dumb.
 */
export const TRANSFER_COPY = {
  title: 'Transfer',
  fromLabel: 'From',
  toLabel: 'To',
  swapLabel: 'Swap direction',
  tokenLabel: 'USDC',
  amountLabel: 'Amount (USDC)',
  transferCta: 'Transfer',
  signingCta: 'Confirm in your wallet…',
  retryCta: 'Try again',
  availablePrefix: 'Available',
} as const

/** Human-readable account names for the From/To selectors. */
export const ACCOUNT_LABEL: Record<TransferAccount, string> = {
  spot: 'Spot',
  perps: 'Perps',
}

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const TRANSFER_ERROR_PROSE: Record<TransferError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available in the source account.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can transfer.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}

export const TRANSFER_ERROR_LABEL = 'Error'

/** role=status aria-live region label so the two-step legibility is non-visual. */
export const TRANSFER_STATUS_ROLE = 'status'
