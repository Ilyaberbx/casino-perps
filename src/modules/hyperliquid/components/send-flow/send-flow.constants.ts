import type {
  SendError,
  SendPercent,
} from '../../providers/send-flow-provider'

/**
 * Copy + a11y constants for the HL send body. Pixel font for labels/buttons,
 * mono font for numbers/addresses (font-zoning). Centralised so the
 * sub-components stay dumb.
 */
export const SEND_COPY = {
  title: 'Send',
  tokenLabel: 'Asset',
  amountLabel: 'Amount',
  availablePrefix: 'Available',
  recipientLabel: 'Recipient address',
  recipientPlaceholder: '0x…',
  summaryTitle: 'Summary',
  youSendLabel: 'You send',
  recipientRowLabel: 'Recipient',
  internalNote: 'Stays on Hyperliquid · arrives instantly',
  reviewCta: 'Review send',
  reviewTitle: 'Review send',
  amountRowLabel: 'Amount',
  toRowLabel: 'To',
  backCta: 'Back',
  signCta: 'Sign send',
  signingCta: 'Confirm in your wallet…',
  retryCta: 'Try again',
  doneCta: 'Done',
  sentLabelPrefix: 'Sent',
} as const

/** The quick-fill percentage chips of the selected token's available balance. */
export const SEND_PERCENT_CHIPS: ReadonlyArray<SendPercent> = [25, 50, 75, 100]

/** Copy for the token-picker's non-`ready` states (loading / error / empty). */
export const SEND_ASSET_STATE_COPY = {
  loading: 'Loading assets…',
  error: "Couldn't load assets.",
  errorRetry: 'Retry',
  empty: 'No transferable assets in this account',
} as const

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const SEND_ERROR_PROSE: Record<SendError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available to send.",
  'destination-invalid': "That recipient address isn't valid. Check it and try again.",
  'self-send': "That's your own address. Enter a different recipient.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can send.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}

export const SEND_ERROR_LABEL = 'Error'

/** role=status aria-live region label so the multi-step legibility is non-visual. */
export const SEND_STATUS_ROLE = 'status'
