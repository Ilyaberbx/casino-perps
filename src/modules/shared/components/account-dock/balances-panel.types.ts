import type { Balance } from '@/modules/shared/domain'

export interface UseBalancesPanelReturn {
  balances: ReadonlyArray<Balance>
  /** Unified / portfolio-margin account: one pool, no Aggregate toggle. */
  isUnified: boolean
  aggregateBalances: boolean
  hideSmallBalances: boolean
  toggleAggregateBalances: () => void
  toggleHideSmallBalances: () => void
  displayedBalances: ReadonlyArray<Balance>
  /** Balances snapshot in flight — render the loading skeleton (ADR-0036). */
  isLoading: boolean
  /** Loaded with zero rows — render the empty state. */
  isEmpty: boolean
  /**
   * Per-row gate for the Transfer affordance (ADR-0033 D-4, slice 05). `true`
   * only for USDC rows when the venue exposes the `transfer` capability, the
   * wallet is connected, and the account is segregated. Unified rows and
   * non-USDC rows are always `false` — the affordance is simply absent.
   */
  canTransfer(balance: Balance): boolean
  /**
   * Opens the shared transfer sheet pre-set From = the row's account: a `spot`
   * row → Spot→Perp, a `perps` row → Perp→Spot. Any other source (e.g.
   * `aggregated`) opens with the default direction (Spot→Perp, no prefill).
   */
  onTransfer(balance: Balance): void
}
