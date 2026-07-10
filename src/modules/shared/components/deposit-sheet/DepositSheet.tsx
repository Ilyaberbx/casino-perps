import { Sheet } from '../Sheet'
import { useDepositSheetContent } from './use-deposit-sheet-content'

const ARIA_LABEL = 'Add cash'

/**
 * Generic, venue-agnostic deposit sheet shell (the host chrome). Wraps the
 * `Sheet` primitive (`side="right"` desktop / `"bottom"` <720px) and mounts the
 * active venue's deposit chrome: `<venue.deposit.provider>` wrapping
 * `<venue.deposit.body />`. The shell knows zero venue specifics — the venue
 * draws its own body (Option A). When the active venue has no `deposit`
 * capability, the sheet renders nothing and never opens. See the deposit ADRs.
 *
 * The venue chrome is mounted ONLY while the sheet is open. The `Sheet`
 * primitive is a persistent `<dialog>` that keeps its children in the DOM even
 * when closed, so an unconditional `<Provider>` would mount the venue's deposit
 * state machine eagerly with the app shell and run its preflight (aborting
 * `wallet-unavailable` before any wallet is resolvable). Gating on `isOpen`
 * runs preflight on the user's intent to deposit and resets it fresh each open.
 */
export function DepositSheet() {
  const { isOpen, close, side, capability } = useDepositSheetContent()

  if (!capability) return null

  const { Provider, Body } = capability

  return (
    <Sheet isOpen={isOpen} onClose={close} side={side} ariaLabel={ARIA_LABEL}>
      {isOpen ? (
        <Provider>
          <Body />
        </Provider>
      ) : null}
    </Sheet>
  )
}
