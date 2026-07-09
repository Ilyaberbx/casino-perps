import { Line } from 'react-chartjs-2'
import styles from './portfolio-chart.module.css'
import type { PortfolioChartProps } from './portfolio-chart.types'
import { PortfolioChartSkeleton } from './PortfolioChartSkeleton'
import { PortfolioChartError } from './PortfolioChartError'
import { PortfolioChartIdle } from './PortfolioChartIdle'
import { usePortfolioChart } from './use-portfolio-chart'
import { isPortfolioChartSeriesIdle } from './portfolio-chart.utils'

export function PortfolioChart({
  title,
  metric,
  window,
  state,
  tone = 'neutral',
}: PortfolioChartProps) {
  const { data, options, plugins } = usePortfolioChart({ state, tone, metric, window })
  const isIdle = state.kind === 'ready' && isPortfolioChartSeriesIdle(state.points)
  const chartKey = `${metric}-${window}`

  return (
    <section className={styles.root} aria-label={title}>
      <div className={styles.body}>
        {state.kind === 'loading' ? <PortfolioChartSkeleton /> : null}
        {state.kind === 'error' ? (
          <PortfolioChartError error={state.error} onRetry={state.onRetry} />
        ) : null}
        {state.kind === 'ready' && data !== null && !isIdle ? (
          <div className={styles.canvasHost}>
            <Line key={chartKey} data={data} options={options} plugins={plugins} />
          </div>
        ) : null}
        {isIdle ? <PortfolioChartIdle /> : null}
      </div>
    </section>
  )
}
