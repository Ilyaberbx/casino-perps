import type { ChartMetric, ChartStateByMetric } from '../../pages/portfolio-page.types'
import type { PortfolioWindow } from '../../../shared/domain'

export interface PortfolioChartCardProps {
  chartMetric: ChartMetric
  onChartMetricChange: (metric: ChartMetric) => void
  charts: ChartStateByMetric
  window: PortfolioWindow
  hasPortfolio: boolean
}
