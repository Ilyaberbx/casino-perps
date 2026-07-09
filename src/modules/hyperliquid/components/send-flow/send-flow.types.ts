import type {
  SendableToken,
  SendPercent,
} from '../../providers/send-flow-provider'
import type { FlowAssetsStatus } from '../shared-flow/shared-flow.types'
import type { RecipientComboboxView } from '@/modules/shared/components/recipient-combobox'

export interface SendFormProps {
  readonly tokens: ReadonlyArray<SendableToken>
  readonly selectedTokenKey: string
  readonly symbol: string
  readonly available: number
  readonly amount: string
  readonly isAmountValid: boolean
  readonly amountInvalidReason: string | null
  /** The recipient value (for the summary "Recipient" tail). */
  readonly destination: string
  /** Whether the recipient is a valid, non-self address (for the summary tail). */
  readonly isDestinationValid: boolean
  /** The recipient combobox view (input + grouped suggestion dropdown). */
  readonly recipient: RecipientComboboxView
  readonly canReview: boolean
  /** Token-picker readiness (spot-meta loading / error / empty / ready). */
  readonly assetsStatus: FlowAssetsStatus
  onSelectToken(key: string): void
  onRetryAssets(): void
  onAmountChange(next: string): void
  onMax(): void
  onPercent(percent: SendPercent): void
  onReview(): void
}

export interface SendReviewProps {
  readonly amount: string
  readonly symbol: string
  readonly destination: string
  readonly isSigning: boolean
  onBack(): void
  onSign(): void
}

export interface SendSuccessProps {
  readonly amount: string
  readonly symbol: string
  onDone(): void
}
