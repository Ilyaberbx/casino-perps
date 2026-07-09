import type { RecipientComboboxView } from '@/modules/shared/components/recipient-combobox'

/** The quick-fill percentages of the withdrawable balance. */
export type AgentWithdrawPercent = 25 | 50 | 75 | 100

/**
 * Props for the dumb withdraw form (the `editing`/`authorizing` step). Mirrors
 * the Hyperliquid withdraw form's shape so the two surfaces stay visually and
 * structurally identical: shared amount input + percent chips + available line +
 * destination field + irreversible-confirm gate + fee-less summary + submit CTA.
 * The parent's smart hook owns all state; this form only renders + forwards.
 */
export interface WithdrawFormProps {
  readonly amount: string
  readonly isAmountValid: boolean
  readonly amountInvalidReason: string | null
  readonly withdrawable: number
  /** The destination combobox view (input + your-wallets/recent suggestion dropdown). */
  readonly recipient: RecipientComboboxView
  /** `true` once the user has typed a destination (arms the irreversible-confirm gate). */
  readonly isDestinationEdited: boolean
  readonly confirmedIrreversible: boolean
  readonly minWithdraw: number
  readonly netReceived: number
  readonly canSubmit: boolean
  /** `true` while the explicit per-action approval is in flight (submit shows pending). */
  readonly isAuthorizing: boolean
  onAmountChange(next: string): void
  onMax(): void
  onPercent(percent: AgentWithdrawPercent): void
  onToggleConfirm(): void
  onSubmit(): void
}
