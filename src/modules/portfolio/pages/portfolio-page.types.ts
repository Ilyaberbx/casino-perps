import type {
  PortfolioMetric,
  PortfolioPoint,
  PortfolioSnapshot,
  PortfolioWindow,
  PortfolioAccountScope,
  PortfolioHistoryError,
} from '../../shared/domain'
export type ChartState =
  | { kind: 'loading' }
  | { kind: 'ready'; points: PortfolioPoint[] }
  | { kind: 'error'; error: PortfolioHistoryError; onRetry: () => void }

export type ChartMetric = Extract<PortfolioMetric, 'accountValue' | 'pnl' | 'perpsPnl'>

export type ChartStateByMetric = Record<ChartMetric, ChartState>

export interface UsePortfolioPageReturn {
  snapshot: PortfolioSnapshot | null
  /**
   * `true` when connected and the first snapshot has not arrived yet — the
   * summary scalars show a loading skeleton. `false` when disconnected (the
   * wallet-gate `$0.00`/`--` empty state shows instead).
   */
  isSnapshotLoading: boolean
  window: PortfolioWindow
  setWindow: (window: PortfolioWindow) => void
  scope: PortfolioAccountScope
  setScope: (scope: PortfolioAccountScope) => void
  chartMetric: ChartMetric
  setChartMetric: (metric: ChartMetric) => void
  charts: ChartStateByMetric
  hasPortfolio: boolean
  /** Active Spectated Address (or null) — keys the account dock so it refreshes per spectated user. */
  spectatedAddress: string | null
  /**
   * Whether the active account keeps Spot and Perp as separate balances. `false`
   * for unified / portfolio-margin accounts, which hide the `'perps'` scope
   * option in the summary card (ADR-0033 D-4). Defaults to `true` (classic).
   */
  isSegregated: boolean
}
