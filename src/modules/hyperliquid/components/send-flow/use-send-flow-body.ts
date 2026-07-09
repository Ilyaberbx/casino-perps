import { useSendFlow } from '../../providers/send-flow-provider'
import type { SendFlowState } from '../../providers/send-flow-provider'
import {
  useRecipientCombobox,
  type RecipientComboboxView,
} from '@/modules/shared/components/recipient-combobox'
import { SEND_COPY } from './send-flow.constants'

export interface SendFlowBodyView {
  readonly flow: SendFlowState
  readonly recipient: RecipientComboboxView
}

/**
 * Smart hook for the send body. Thin pass-through over the rich machine state
 * (`useSendFlow`) plus the shared recipient combobox's local UI state
 * (`useRecipientCombobox`) — the body is the single state owner for its dumb
 * sub-components. The combobox reads/writes only the destination on the flow; the
 * machine still owns validation. Kept as a hook so the body stays dumb and the
 * seam is testable.
 */
export function useSendFlowBody(): SendFlowBodyView {
  const flow = useSendFlow()
  const recipient = useRecipientCombobox({
    value: flow.destination,
    walletSuggestions: flow.walletSuggestions,
    recentSuggestions: flow.recentSuggestions,
    onChange: flow.setDestination,
    inputId: 'send-recipient',
    label: SEND_COPY.recipientLabel,
    hint: null,
    ariaLabel: SEND_COPY.recipientLabel,
    placeholder: SEND_COPY.recipientPlaceholder,
    isInvalid: flow.destination !== '' && !flow.isDestinationValid,
    invalidReason: flow.destinationInvalidReason,
  })
  return { flow, recipient }
}
