import { Sheet } from '../Sheet'
import { useTransferSheetContent } from './use-transfer-sheet-content'
import type {
  ApplicableGateProps,
  TransferSheetCapabilityView,
} from './transfer-sheet.types'

const ARIA_LABEL = 'Transfer funds'

/**
 * Generic, venue-agnostic transfer sheet shell (the host chrome). Wraps the
 * `Sheet` primitive (`side="right"` desktop / `"bottom"` <720px) and mounts the
 * active venue's transfer chrome: `<venue.transfer.provider>` wrapping
 * `<venue.transfer.body />`. The shell knows zero venue specifics — the venue
 * draws its own body (Option A). Two gates, both per ADR-0033 D-1 / D-4:
 *
 * 1. No `transfer` capability on the active venue → the sheet renders nothing
 *    and never opens (mirrors `DepositSheet`).
 * 2. The capability exists but the account is not segregated (`!isApplicable`,
 *    e.g. a unified / portfolio-margin account) → the inner gate renders
 *    nothing inside the (closed) sheet.
 *
 * The venue chrome is mounted ONLY while the sheet is open — `Sheet` is a
 * persistent `<dialog>` whose children stay in the DOM when closed, so an
 * unconditional `<Provider>` would mount the venue's transfer state machine
 * eagerly with the app shell. Gating on `isOpen` mounts it on the user's intent
 * to transfer and resets it fresh each open.
 */
export function TransferSheet() {
  const { isOpen, close, side, capability } = useTransferSheetContent()

  if (!capability) return null

  return (
    <Sheet isOpen={isOpen} onClose={close} side={side} ariaLabel={ARIA_LABEL}>
      {isOpen ? <TransferChrome capability={capability} /> : null}
    </Sheet>
  )
}

/**
 * Mounts the venue's transfer provider so the inner `ApplicableGate` can read
 * `useTransfer().isApplicable` — that hook is provider-bound, so the read must
 * happen inside `<Provider>`, not in the shell's smart hook.
 */
function TransferChrome({ capability }: { capability: TransferSheetCapabilityView }) {
  const { Provider, Body, useTransfer } = capability
  return (
    <Provider>
      <ApplicableGate useTransfer={useTransfer} Body={Body} />
    </Provider>
  )
}

function ApplicableGate({ useTransfer, Body }: ApplicableGateProps) {
  const { isApplicable } = useTransfer()
  if (!isApplicable) return null
  return <Body />
}
