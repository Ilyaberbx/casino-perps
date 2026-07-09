import styles from './portfolio-chart-card.module.css'
import type { PortfolioChartCardProps } from './portfolio-chart-card.types'
import type { ChartMetric } from '../../pages/portfolio-page.types'
import { CHART_METRIC_OPTIONS } from './portfolio-chart-card.constants'
import { PortfolioChart } from '../portfolio-chart'
import type { PortfolioChartTone } from '../portfolio-chart/portfolio-chart.types'
import {
  computePeriodDelta,
  formatPeriodDelta,
} from '../portfolio-chart/portfolio-chart.utils'
import { SegmentedControl } from '../../../shared/components/segmented-control'

const METRIC_LABEL: Record<ChartMetric, string> = {
  accountValue: 'Account Value',
  pnl: 'PNL',
  perpsPnl: 'Perps PNL',
}

const SIGN_TO_TONE: Record<'up' | 'down' | 'flat', PortfolioChartTone> = {
  up: 'up',
  down: 'down',
  flat: 'up',
}

const DELTA_TONE_CLASS: Record<'up' | 'down' | 'flat', string> = {
  up: styles.deltaUp,
  down: styles.deltaDown,
  flat: styles.deltaFlat,
}


export function PortfolioChartCard({
  chartMetric,
  onChartMetricChange,
  charts,
  window,
  hasPortfolio,
}: PortfolioChartCardProps) {
  const activeState = charts[chartMetric]

  if (!hasPortfolio) {
    return (
      <section className={styles.root} aria-label="Portfolio chart">
        <div className={styles.header}>
          <span className={styles.headerLabel}>Chart</span>
        </div>
        <div className={styles.body}>
          <div className={styles.unsupported}>Chart not supported by this venue</div>
        </div>
      </section>
    )
  }

  const isReady = activeState.kind === 'ready'
  const delta = isReady ? computePeriodDelta(activeState.points) : null
  const hasMeaningfulDelta = delta !== null && delta.sign !== 'flat'
  const deltaText = delta ? formatPeriodDelta(chartMetric, delta) : ''
  const deltaToneClass = DELTA_TONE_CLASS[delta?.sign ?? 'flat']
  const activeTone: PortfolioChartTone = SIGN_TO_TONE[delta?.sign ?? 'up']

  return (
    <section className={styles.root} aria-label="Portfolio chart">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerLabel}>Chart</span>
          <SegmentedControl<ChartMetric>
            options={CHART_METRIC_OPTIONS}
            value={chartMetric}
            onChange={onChartMetricChange}
            ariaLabel="Chart metric selector"
          />
        </div>
        {hasMeaningfulDelta ? (
          <span
            className={`${styles.deltaBadge} ${deltaToneClass}`}
            aria-label={`Window change ${deltaText}`}
          >
            {deltaText}
          </span>
        ) : null}
      </div>
      <div className={styles.body}>
        <PortfolioChart
          title={METRIC_LABEL[chartMetric]}
          metric={chartMetric}
          window={window}
          state={activeState}
          tone={activeTone}
        />
      </div>
    </section>
  )
}
