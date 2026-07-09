import { useHip3AbstractionGateButton } from './use-hip3-abstraction-gate-button'
import styles from './hip3-abstraction-gate-button.module.css'
import type { Hip3AbstractionGateButtonProps } from './hip3-abstraction-gate-button.types'

/**
 * HIP-3 trading gate for the Place Order submit button (ADR-0081). Stacks
 * *inside* `<TradeableFundsGateButton>`, so it only evaluates once wallet,
 * onboarding, and funding gates have passed. Renders:
 * - children when the market is not HIP-3, the venue exposes no HIP-3
 *   capability, or abstraction is already enabled,
 * - a disabled "Checking…" button while the abstraction-mode read is in flight,
 * - a disabled "Enabling HIP-3…" button while the enable signature is in flight,
 * - an "Enable HIP-3 trading" button (with an optional error hint) when a
 *   default account targets a HIP-3 market — a clear one-signature gate rather
 *   than an opaque "insufficient margin" venue rejection.
 *
 * Mirrors `<TradeableFundsGateButton>` (mode-4 of `wallet-gate.md`).
 */
export function Hip3AbstractionGateButton({ isHip3, children }: Hip3AbstractionGateButtonProps) {
  const state = useHip3AbstractionGateButton(isHip3)

  if (state.kind === 'ready') return <>{children}</>

  if (state.kind === 'checking') {
    return (
      <button type="button" className={styles.button} disabled aria-busy="true">
        <span className={styles.spinner} aria-hidden="true" />
        Checking…
      </button>
    )
  }

  if (state.kind === 'enabling') {
    return (
      <button type="button" className={styles.button} disabled aria-busy="true">
        <span className={styles.spinner} aria-hidden="true" />
        Enabling HIP-3…
      </button>
    )
  }

  return (
    <div className={styles.wrap}>
      {state.errorCopy ? <div className={styles.error}>{state.errorCopy}</div> : null}
      <button type="button" className={styles.button} onClick={state.onEnable}>
        Enable HIP-3 trading
      </button>
    </div>
  )
}
