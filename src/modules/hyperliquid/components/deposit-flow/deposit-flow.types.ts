import type { DepositFlowErrorReason } from '../../providers/deposit-flow-provider'

export interface NeedsFundingTrackProps {
  readonly address: string
  readonly walletUsdc: number
}

export interface ReadyTrackProps {
  readonly amount: string
  readonly isAmountValid: boolean
  readonly amountInvalidReason: string | null
  readonly showGasWarning: boolean
  readonly isSigning: boolean
  onAmountChange(next: string): void
  onMax(): void
  onSubmit(): void
}

export interface SuccessTrackProps {
  /** `true` once funds are credited on Hyperliquid (phase-2 complete). */
  readonly isCredited: boolean
  onDone(): void
}

export interface DepositErrorCalloutProps {
  readonly reason: DepositFlowErrorReason
  onRetry(): void
}
