/**
 * Copy + a11y constants for the HL deposit body. Pixel font for labels/buttons,
 * mono font for numbers/addresses (font-zoning). Centralised so the per-track
 * sub-components stay dumb.
 */

/** Receive-QR module size (px). ≥140 stays scannable on mobile (brief). */
export const DEPOSIT_QR_SIZE = 160

export const DEPOSIT_COPY = {
  title: 'Deposit to Hyperliquid',
  checking: 'Reading wallet…',
  selfCustodyLabel: 'Warning',
  selfCustodyProse:
    'Deposit only from a wallet you control. Funds sent from an exchange will be lost.',
  noGasLabel: 'Heads up',
  noGasProse: "You'll need a little ETH on Arbitrum to cover gas.",
  switchChainCta: 'Switch to Arbitrum',
  depositCta: 'Deposit to Hyperliquid',
  signingCta: 'Confirm in your wallet…',
  amountLabel: 'Amount (USDC)',
  sentLabel: 'Sent from wallet',
  creditingLabel: 'Crediting to Hyperliquid…',
  creditedLabel: 'Funds available on Hyperliquid',
  doneCta: 'Start trading',
  retryCta: 'Try again',
} as const

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const DEPOSIT_ERROR_PROSE = {
  'wallet-rejected': 'You declined the request in your wallet.',
  'chain-switch-failed': "Couldn't switch your wallet to Arbitrum.",
  'transfer-failed': "The transfer didn't go through. Your funds are untouched.",
  'insufficient-balance': "That amount isn't available in your wallet.",
  unknown: 'Something went wrong. Please try again.',
} as const

export const DEPOSIT_ERROR_LABEL = 'Error'

/** role=status aria-live region label so the two-step legibility is non-visual. */
export const DEPOSIT_STATUS_ROLE = 'status'
