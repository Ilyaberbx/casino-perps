import type {
  WithdrawError,
  WithdrawPercent,
} from '../../providers/withdraw-flow-provider'

/**
 * Copy + a11y constants for the HL withdraw body. Pixel font for labels/buttons,
 * mono font for numbers/addresses (font-zoning). Centralised so the
 * sub-components stay dumb. Re-exported from the provider unit where the value
 * is shared (fee/min/arrival), redeclared here only for body-local copy.
 */
export const WITHDRAW_COPY = {
  title: 'Cash Out to Wallet',
  amountLabel: 'Amount (USDC)',
  tokenLabel: 'USDC',
  availablePrefix: 'Available to cash out',
  destinationLabel: 'Destination address',
  ownWalletHint: '(your wallet)',
  destinationPlaceholder: '0x…',
  irreversibleLabel: 'Warning',
  irreversibleProse: 'Cash-outs are irreversible. Double-check the address.',
  confirmLabel: 'I understand this cash-out is irreversible',
  feeLabel: 'Fee',
  minLabel: 'Min',
  receiveLabel: 'You receive',
  arrivalLabel: 'Arrives',
  reviewCta: 'Review cash-out',
  reviewTitle: 'Review cash-out',
  amountRowLabel: 'Amount',
  destinationRowLabel: 'To',
  backCta: 'Back',
  signCta: 'Confirm cash-out',
  signingCta: 'Confirm in your wallet…',
  retryCta: 'Try again',
  doneCta: 'Done',
  signedLabel: 'Cash-out sent',
  arrivingLabel: 'Arriving on Arbitrum',
} as const

/** Approximate Arbitrum arrival window, surfaced in the summary + arrival track. */
export const WITHDRAW_ARRIVAL_LABEL = '~5 min'

/** The quick-fill percentage chips of the withdrawable balance. */
export const WITHDRAW_PERCENT_CHIPS: ReadonlyArray<WithdrawPercent> = [25, 50, 75, 100]

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const WITHDRAW_ERROR_PROSE: Record<WithdrawError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available to cash out.",
  'destination-invalid': "That destination address isn't valid. Check it and try again.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can cash out.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}

export const WITHDRAW_ERROR_LABEL = 'Error'

/** role=status aria-live region label so the multi-step legibility is non-visual. */
export const WITHDRAW_STATUS_ROLE = 'status'
