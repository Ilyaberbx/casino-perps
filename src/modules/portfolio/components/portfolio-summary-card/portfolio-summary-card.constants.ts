import type { PortfolioAccountScope, PortfolioWindow } from '../../../shared/domain'

export const PERIOD_OPTIONS: ReadonlyArray<{ label: string; value: PortfolioWindow }> = [
  { label: '24 Hours', value: '24H' },
  { label: '7 Days', value: '7D' },
  { label: '30 Days', value: '30D' },
  { label: 'All-Time', value: 'AllTime' },
] as const

export const SCOPE_OPTIONS: ReadonlyArray<{ label: string; value: PortfolioAccountScope }> = [
  { label: 'All', value: 'all' },
  { label: 'Only Perps', value: 'perps' },
] as const

/** Dim dash for a Venue-unsupplied facet (Max Drawdown) — never app-computed. */
export const EQUITY_PLACEHOLDER = '—'

/** Row labels for the restyled Account Equity panel, in reference order (#275). */
export const SUMMARY_ROW_LABELS = {
  pnl: 'PNL',
  volume: 'Volume',
  maxDrawdown: 'Max Drawdown',
  totalEquity: 'Total Equity',
  perpEquity: 'Perp Account Equity',
  spotEquity: 'Spot Account Equity',
} as const
