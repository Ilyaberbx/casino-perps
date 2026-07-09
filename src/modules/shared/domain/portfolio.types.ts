export type PortfolioMetric = 'accountValue' | 'pnl' | 'perpsPnl' | 'volume'

export type PortfolioWindow = '24H' | '7D' | '30D' | 'AllTime'

export type PortfolioAccountScope = 'all' | 'perps'

/**
 * A scalar keyed by every Portfolio period. PnL and Volume differ per window
 * (the 24H bucket is not the All-Time bucket), so the snapshot carries one value
 * per window and the summary card selects by its `window` prop. See ADR-0039.
 */
export type PortfolioWindowValues = Readonly<Record<PortfolioWindow, number>>

export interface PortfolioSnapshot {
  accountValue: number
  /** Window-keyed PnL — select with the active period. See ADR-0039. */
  pnl: PortfolioWindowValues
  perpsPnl: number
  /** Window-keyed Volume — select with the active period. See ADR-0039. */
  volume: PortfolioWindowValues
  spotEquity: number
  perpsEquity: number
  fourteenDayVolume: number
  timestamp: number
}

export interface PortfolioPoint {
  timestamp: number
  value: number
}

export type PortfolioHistoryErrorKind =
  | 'unknown-metric'
  | 'unknown-window'
  | 'wallet-not-connected'
  | 'unsupported-metric'
