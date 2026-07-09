import type {
  PortfolioAccountScope,
  PortfolioSnapshot,
  PortfolioWindow,
} from '../../../shared/domain'

export interface PortfolioSummaryCardProps {
  snapshot: PortfolioSnapshot | null
  window: PortfolioWindow
  onWindowChange: (window: PortfolioWindow) => void
  scope: PortfolioAccountScope
  onScopeChange: (scope: PortfolioAccountScope) => void
  isConnected: boolean
  /** `true` while connected and the first snapshot is loading — scalars show skeletons. */
  isLoading: boolean
  /**
   * Whether the account keeps Spot and Perp separate. `false` (unified /
   * portfolio-margin) hides the `'perps'` scope option — a unified account shows
   * only the combined view (ADR-0033 D-4).
   */
  isSegregated: boolean
}

/**
 * How a summary row renders its value. `placeholder` always shows the dim dash
 * (used for Venue-unsupplied facets like Max Drawdown — never app-computed, see
 * CONTEXT.md / #275).
 */
export type SummaryRowFormat = 'signedCurrency' | 'currency' | 'placeholder'

/** One row in the restyled Account Equity panel (#275). */
export interface SummaryRow {
  readonly key: string
  readonly label: string
  readonly value: number | null
  readonly format: SummaryRowFormat
}

export interface SummaryRowItemProps {
  readonly row: SummaryRow
  readonly isLoading: boolean
}

export interface PortfolioSummaryCardContent {
  /** Simple mode renders the scope/period controls as dropdowns (#276). */
  readonly isSimple: boolean
  readonly isConnected: boolean
  readonly isLoading: boolean
  readonly scope: PortfolioAccountScope
  readonly window: PortfolioWindow
  readonly scopeOptions: ReadonlyArray<{ label: string; value: PortfolioAccountScope }>
  readonly periodOptions: ReadonlyArray<{ label: string; value: PortfolioWindow }>
  readonly rows: ReadonlyArray<SummaryRow>
  /** Narrows the raw dropdown value before delegating to `onScopeChange`. */
  onScopeSelect(value: string): void
  /** Narrows the raw dropdown value before delegating to `onWindowChange`. */
  onWindowSelect(value: string): void
}
