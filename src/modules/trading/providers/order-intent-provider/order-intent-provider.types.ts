import type { ReactNode } from 'react'
import type { OrderIntent } from '../../trading.types'

/**
 * The order-intent bus (issue #213). The suggestion sheet `publish`es a
 * Directional prefill; the order ticket reads `pending` and applies the patch +
 * leverage. `pending` is reactive state so a publish re-renders the ticket; the
 * ticket applies each distinct intent **once** (a render-time identity tracker —
 * React 19 idiom, no setState in effects) so a re-render never re-applies a
 * stale suggestion and the user edits the ticket freely afterwards. The user
 * always confirms via the ticket's own Place Order — publishing never executes
 * an order.
 */
export interface OrderIntentContextValue {
  /** The most recently published intent, or `null` when none. */
  readonly pending: OrderIntent | null
  /** Publish a prefill from the suggestion sheet. Replaces any prior pending. */
  publish(intent: OrderIntent): void
}

export interface OrderIntentProviderProps {
  readonly children: ReactNode
}
