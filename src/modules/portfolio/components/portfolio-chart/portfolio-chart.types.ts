import type {
  PortfolioPoint,
  PortfolioHistoryError,
  PortfolioWindow,
} from '../../../shared/domain'

export type PortfolioChartTone = 'up' | 'down' | 'neutral'

export type PortfolioChartMetric = 'accountValue' | 'pnl' | 'perpsPnl'

export type PortfolioChartState =
  | { kind: 'loading' }
  | { kind: 'ready'; points: PortfolioPoint[] }
  | { kind: 'error'; error: PortfolioHistoryError; onRetry: () => void }

export interface PortfolioChartProps {
  title: string
  metric: PortfolioChartMetric
  window: PortfolioWindow
  state: PortfolioChartState
  tone?: PortfolioChartTone
}

export interface PortfolioChartErrorProps {
  error: PortfolioHistoryError
  onRetry: () => void
}
