import type { WithdrawError, WithdrawPercent } from './withdraw-flow-provider.types'

/**
 * USDC carries 6 decimals on Hyperliquid. An amount with more fractional digits
 * than this is rejected as invalid precision before signing (the wire schema
 * would reject it anyway — we fail it client-side with a plain message).
 */
export const USDC_WITHDRAW_DECIMALS = 6

/** Hyperliquid charges a flat $1 L1 withdrawal fee on `withdraw3`. */
export const WITHDRAW_FEE_USDC = 1

/** The minimum withdrawal amount in USDC (must clear the flat fee + a buffer). */
export const MIN_WITHDRAW_USDC = 2

/** The quick-fill percentage chips of the withdrawable balance. */
export const WITHDRAW_PERCENTS: ReadonlyArray<WithdrawPercent> = [25, 50, 75, 100]

/** Approximate Arbitrum arrival time, surfaced in the summary + arrival track. */
export const WITHDRAW_ARRIVAL_LABEL = '~5 min'

/**
 * Copy + a11y constants for the HL withdraw body. Pixel font for labels/buttons,
 * mono font for numbers/addresses (font-zoning). Centralised so the
 * sub-components stay dumb.
 */
export const WITHDRAW_COPY = {
  title: 'Withdraw to Arbitrum',
  amountLabel: 'Amount (USDC)',
  tokenLabel: 'USDC',
  availablePrefix: 'Available to withdraw',
  destinationLabel: 'Destination address',
  ownWalletHint: '(your wallet)',
  irreversibleLabel: 'Warning',
  irreversibleProse: 'Withdrawals are irreversible. Double-check the address.',
  confirmLabel: 'I understand this withdrawal is irreversible',
  feeLabel: 'Fee',
  minLabel: 'Min',
  receiveLabel: 'You receive',
  arrivalLabel: 'Arrives',
  reviewCta: 'Review withdrawal',
  backCta: 'Back',
  signCta: 'Sign withdrawal',
  signingCta: 'Confirm in your wallet…',
  retryCta: 'Try again',
  doneCta: 'Done',
  reviewTitle: 'Review withdrawal',
  amountRowLabel: 'Amount',
  destinationRowLabel: 'To',
  signedLabel: 'Withdrawal signed',
  arrivingLabel: 'Arriving on Arbitrum',
} as const

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const WITHDRAW_ERROR_PROSE: Record<WithdrawError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available to withdraw.",
  'destination-invalid': "That destination address isn't valid. Check it and try again.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can withdraw.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}

export const WITHDRAW_ERROR_LABEL = 'Error'

/** role=status aria-live region label so the multi-step legibility is non-visual. */
export const WITHDRAW_STATUS_ROLE = 'status'
