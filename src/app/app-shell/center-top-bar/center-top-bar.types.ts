export interface CenterTopBarProps {
  authenticated: boolean
  /** Formatted perp equity ("$1,234.56"), or null when there is nothing to show. */
  equityLabel: string | null
  /** True while the first portfolio snapshot is in flight — chip shows a shimmer. */
  isEquityLoading: boolean
  onOpenSearch: () => void
  onLogIn: () => void
  onCreateAccount: () => void
}

export interface BalanceChipProps {
  label: string | null
  isLoading: boolean
}
