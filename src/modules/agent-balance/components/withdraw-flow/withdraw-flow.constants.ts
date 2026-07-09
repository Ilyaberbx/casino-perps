import type { AgentTransferErrorReason } from '../../agent-balance.types'
import type { AgentWithdrawPercent } from './withdraw-flow.types'

/**
 * Copy for the Agent Wallet withdraw form. Kept in lock-step with the Hyperliquid
 * withdraw form's copy so the two surfaces read identically, minus the HL-only
 * fee / arrival lines (a direct Base USDC transfer has no protocol fee and mines
 * near-instantly, so the summary shows only Min + You receive).
 */
export const WITHDRAW_COPY = {
  lead: 'Send USDC from your Agent Wallet to any Base address. Each withdrawal needs its own explicit approval.',
  amountLabel: 'Amount (USDC)',
  tokenLabel: 'USDC',
  availablePrefix: 'Available to withdraw',
  destinationLabel: 'Destination (Base address)',
  destinationPlaceholder: '0x…',
  destinationInvalid: 'Enter a valid Base address',
  irreversibleLabel: 'Warning',
  irreversibleProse: 'Withdrawals are irreversible. Double-check the address.',
  confirmLabel: 'I understand this withdrawal is irreversible',
  minLabel: 'Min',
  receiveLabel: 'You receive',
  submitCta: 'Authorize withdrawal',
  authorizingCta: 'Awaiting approval…',
  retryCta: 'Try again',
  checkStatusCta: 'Okay',
  switchNetworkCta: 'Switch to Base',
  errorLabel: 'Error',
  statusLabel: 'Still confirming',
  sent: 'Sent. Your Agent Balance will update once mined.',
} as const

/** The quick-fill percentage chips of the withdrawable balance. */
export const WITHDRAW_PERCENT_CHIPS: ReadonlyArray<AgentWithdrawPercent> = [25, 50, 75, 100]

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const WITHDRAW_ERROR_PROSE: Record<AgentTransferErrorReason, string> = {
  'wallet-rejected': 'You declined the request in your wallet.',
  'wrong-network': 'Switch your wallet to Base (8453) to withdraw.',
  'insufficient-gas':
    "Your Agent Wallet doesn't have enough ETH on Base to pay the network fee. Send a small amount of ETH to your Agent Wallet, then try again.",
  'insufficient-balance':
    "Your Agent Wallet's USDC balance is too low to cover this amount. Lower the amount and try again.",
  'receipt-timeout':
    'Base is taking longer than usual to confirm this transfer. It may still be processing — check your Agent Balance before retrying.',
  'transfer-failed': "Couldn't send the withdrawal. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}

/** Reasons that are not failures — the transfer may still land, so they get a
 * calmer callout treatment (`info`, not `error`) and a dismiss-style CTA
 * instead of "Try again" (which would wrongly imply resubmitting). */
export const WITHDRAW_NON_FAILURE_REASONS: ReadonlySet<AgentTransferErrorReason> = new Set([
  'receipt-timeout',
])

/**
 * The retry button's label per error reason. `wrong-network`'s "Try again"
 * would be a no-op (the wallet's chain never changes on its own) — its button
 * performs a real, verified chain switch instead (ADR-0082), so it gets its
 * own label. `receipt-timeout` is not a failure, so it reuses the dismiss
 * label rather than "Try again" (which would imply resubmitting a transfer
 * that already broadcast).
 */
export const WITHDRAW_ERROR_CTA: Record<AgentTransferErrorReason, string> = {
  'wallet-rejected': WITHDRAW_COPY.retryCta,
  'wrong-network': WITHDRAW_COPY.switchNetworkCta,
  'insufficient-gas': WITHDRAW_COPY.retryCta,
  'insufficient-balance': WITHDRAW_COPY.retryCta,
  'receipt-timeout': WITHDRAW_COPY.checkStatusCta,
  'transfer-failed': WITHDRAW_COPY.retryCta,
  unknown: WITHDRAW_COPY.retryCta,
}
