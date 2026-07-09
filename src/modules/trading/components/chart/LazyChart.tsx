import { lazy, Suspense } from 'react'
import { ChartSkeleton } from './ChartSkeleton'
import styles from './chart.module.css'

// Code-split: lightweight-charts (~the charting lib) is only ever runtime-imported
// through Chart -> use-chart. Loading Chart lazily keeps it out of the synchronous
// trade-route chunk, so the top bar / orderbook / order entry paint without waiting
// on the chart lib to parse.
const Chart = lazy(() => import('./Chart').then((module) => ({ default: module.Chart })))

export function LazyChart() {
  // The fallback mirrors the chart's own root/body shell so the absolutely
  // positioned skeleton overlay fills the chart area (no collapse / layout shift)
  // while the chunk loads. The skeleton hands off to the real Chart's own
  // skeleton on mount, so the transition is seamless.
  return (
    <Suspense
      fallback={
        <div className={styles.root}>
          <div className={styles.body}>
            <ChartSkeleton />
          </div>
        </div>
      }
    >
      <Chart />
    </Suspense>
  )
}
