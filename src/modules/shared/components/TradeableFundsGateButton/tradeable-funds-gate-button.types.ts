import type { ReactNode } from 'react'

export interface TradeableFundsGateButtonProps {
  readonly children: ReactNode
}

/**
 * Tradeable Funds gate state (ADR-0027 D-3/D-6):
 * - `ready` — perp `accountValue > 0`, or the active venue exposes no
 *   `portfolio` capability (nothing to gate on) → render the submit affordance.
 * - `checking` — portfolio capability present but no Snapshot received yet →
 *   hold the submit affordance behind a disabled "Checking…" button.
 * - `no-funds` — perp `accountValue == 0` → block with a "Deposit to trade"
 *   affordance instead of letting an opaque venue rejection surface.
 */
export type TradeableFundsGateButtonState =
  | { readonly kind: 'ready' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'no-funds' }
