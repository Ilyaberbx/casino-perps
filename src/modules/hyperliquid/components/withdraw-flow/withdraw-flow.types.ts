import type { WithdrawPercent } from '../../providers/withdraw-flow-provider'
import type { RecipientComboboxView } from '@/modules/shared/components/recipient-combobox'

export interface WithdrawFormProps {
  readonly amount: string
  readonly isAmountValid: boolean
  readonly amountInvalidReason: string | null
  readonly withdrawable: number
  /** The destination combobox view (input + your-wallets/recent suggestion dropdown). */
  readonly recipient: RecipientComboboxView
  /** `true` once the user has typed over the prefilled destination (arms the confirm gate). */
  readonly isDestinationEdited: boolean
  readonly confirmedIrreversible: boolean
  readonly fee: number
  readonly minWithdraw: number
  readonly netReceived: number
  readonly canReview: boolean
  onAmountChange(next: string): void
  onMax(): void
  onPercent(percent: WithdrawPercent): void
  onToggleConfirm(): void
  onReview(): void
}

export interface WithdrawReviewProps {
  readonly amount: string
  readonly destination: string
  readonly fee: number
  readonly netReceived: number
  readonly isSigning: boolean
  onBack(): void
  onSign(): void
}

export interface WithdrawArrivalTrackProps {
  onDone(): void
}
