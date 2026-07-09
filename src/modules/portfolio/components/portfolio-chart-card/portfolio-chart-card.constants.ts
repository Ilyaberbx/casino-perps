import type { ChartMetric } from '../../pages/portfolio-page.types'

export const CHART_METRIC_OPTIONS: ReadonlyArray<{ label: string; value: ChartMetric }> = [
  { label: 'Account Value', value: 'accountValue' },
  { label: 'PNL', value: 'pnl' },
  { label: 'Perps PNL', value: 'perpsPnl' },
] as const
