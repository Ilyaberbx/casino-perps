import { useTradeableFundsGateButton } from './use-tradeable-funds-gate-button'
import styles from './tradeable-funds-gate-button.module.css'
import type { TradeableFundsGateButtonProps } from './tradeable-funds-gate-button.types'

/**
 * Live Tradeable Funds gate for the Place Order submit button (ADR-0027 D-6).
 * Stacks *inside* `<VenueOnboardingGateButton>`, so it only evaluates once
 * onboarding setup is complete. Renders:
 * - children when the connected wallet has perp `accountValue > 0` (or the
 *   venue exposes no `portfolio` capability),
 * - a disabled "Checking…" button while the first Snapshot is in flight,
 * - a disabled "Deposit to trade" button when perp `accountValue == 0` — a
 *   clear gate rather than an opaque venue rejection.
 *
 * Mirrors `<VenueOnboardingGateButton>` (mode-4 of `wallet-gate.md`).
 */
export function TradeableFundsGateButton({ children }: TradeableFundsGateButtonProps) {
  const state = useTradeableFundsGateButton()

  if (state.kind === 'ready') return <>{children}</>

  if (state.kind === 'checking') {
    return (
      <button type="button" className={styles.button} disabled aria-busy="true">
        <span className={styles.spinner} aria-hidden="true" />
        Checking…
      </button>
    )
  }

  return (
    <button type="button" className={styles.button} disabled>
      Deposit to trade
    </button>
  )
}
