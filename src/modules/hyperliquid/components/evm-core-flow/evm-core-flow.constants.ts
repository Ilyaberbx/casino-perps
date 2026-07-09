import type {
  EvmCoreDirection,
  EvmCoreError,
  EvmCorePercent,
} from '../../providers/evm-core-flow-provider'

/**
 * Copy + a11y constants for the HL EVM⇄Core body. Pixel font for labels/buttons,
 * mono font for numbers (font-zoning). Centralised so the sub-components stay
 * dumb.
 */
export const EVM_CORE_COPY = {
  title: 'EVM⇄Core',
  directionLabel: 'Direction',
  tokenLabel: 'Asset',
  amountLabel: 'Amount',
  availablePrefix: 'Available',
  youMoveLabel: 'You move',
  destinationRowLabel: 'To',
  reviewCta: 'Review transfer',
  amountRowLabel: 'Amount',
  backCta: 'Back',
  signCta: 'Sign transfer',
  signingCta: 'Confirm in your wallet…',
  retryCta: 'Try again',
  doneCta: 'Done',
  movedLabelPrefix: 'Moved',
  checkingNote: 'Checking HyperEVM…',
  switchChainCta: 'Switch to HyperEVM',
  noGasHeadline: 'No HYPE for gas',
  noGasBody: 'You need HYPE on HyperEVM to pay gas for this transfer.',
  viewTxCta: 'View transaction',
} as const

/** Copy for the token-picker's non-`ready` states (loading / error / empty). */
export const EVM_CORE_ASSET_STATE_COPY = {
  loading: 'Loading assets…',
  error: "Couldn't load assets.",
  errorRetry: 'Retry',
  empty: 'No transferable assets in this account',
} as const

/** The destination shown per direction (the move always lands on the user's own account). */
export const EVM_CORE_DESTINATION_VALUE: Record<EvmCoreDirection, string> = {
  'core-to-evm': 'Your HyperEVM address',
  'evm-to-core': 'Your HyperCore balance',
}

/** The credited note shown per direction. */
export const EVM_CORE_INTERNAL_NOTE: Record<EvmCoreDirection, string> = {
  'core-to-evm': 'Credited to your HyperEVM address',
  'evm-to-core': 'Credited to your HyperCore balance',
}

/** The success-line suffix per direction (`Moved {amount} {symbol} {suffix}`). */
export const EVM_CORE_MOVED_SUFFIX: Record<EvmCoreDirection, string> = {
  'core-to-evm': 'to HyperEVM',
  'evm-to-core': 'to HyperCore',
}

/** The two direction options — both live (Core→EVM slice 1, EVM→Core slice 2). */
export const EVM_CORE_DIRECTION_OPTIONS: ReadonlyArray<{
  readonly direction: EvmCoreDirection
  readonly label: string
  readonly enabled: boolean
}> = [
  { direction: 'core-to-evm', label: 'Core → EVM', enabled: true },
  { direction: 'evm-to-core', label: 'EVM → Core', enabled: true },
]

/** The quick-fill percentage chips of the selected token's available balance. */
export const EVM_CORE_PERCENT_CHIPS: ReadonlyArray<EvmCorePercent> = [25, 50, 75, 100]

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const EVM_CORE_ERROR_PROSE: Record<EvmCoreError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available to move.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can move tokens.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  'chain-switch-failed': "Couldn't switch your wallet to HyperEVM. Try again.",
  'transfer-failed': "The HyperEVM transfer didn't go through. Try again.",
  unknown: 'Something went wrong. Please try again.',
}

export const EVM_CORE_ERROR_LABEL = 'Error'

/** role=status aria-live region label so the multi-step legibility is non-visual. */
export const EVM_CORE_STATUS_ROLE = 'status'
