import { useWithdrawFlow } from '../../providers/withdraw-flow-provider'
import type { WithdrawFlowState } from '../../providers/withdraw-flow-provider'
import {
  useRecipientCombobox,
  type RecipientComboboxView,
} from '@/modules/shared/components/recipient-combobox'
import { WITHDRAW_COPY } from './withdraw-flow.constants'

export interface WithdrawFlowBodyView {
  readonly flow: WithdrawFlowState
  readonly recipient: RecipientComboboxView
}

/**
 * Smart hook for the withdraw body. Thin pass-through over the rich machine state
 * (`useWithdrawFlow`) plus the shared recipient combobox's local UI state — the
 * body is the single state owner for its dumb sub-components. The combobox writes
 * only the destination on the flow; the machine still owns validation. The
 * "(your wallet)" hint shows until the user edits the prefilled destination.
 */
export function useWithdrawFlowBody(): WithdrawFlowBodyView {
  const flow = useWithdrawFlow()
  const recipient = useRecipientCombobox({
    value: flow.destination,
    walletSuggestions: flow.walletSuggestions,
    recentSuggestions: flow.recentSuggestions,
    onChange: flow.setDestination,
    inputId: 'withdraw-destination',
    label: WITHDRAW_COPY.destinationLabel,
    hint: flow.isDestinationEdited ? null : WITHDRAW_COPY.ownWalletHint,
    ariaLabel: WITHDRAW_COPY.destinationLabel,
    placeholder: WITHDRAW_COPY.destinationPlaceholder,
    isInvalid: !flow.isDestinationValid,
    invalidReason: null,
  })
  return { flow, recipient }
}
