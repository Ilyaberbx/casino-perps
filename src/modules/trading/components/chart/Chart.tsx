import { useChartView } from './use-chart-view'
import { ChartHeader } from './ChartHeader'
import { ChartSkeleton } from './ChartSkeleton'
import { ChartErrorTile } from './ChartErrorTile'
import { ChartUnavailableTile } from './ChartUnavailableTile'
import styles from './chart.module.css'

export function Chart() {
  const {
    containerRef,
    hasCandleData,
    error,
    noCandles,
    retry,
    crosshairOhlc,
    liveBadge,
    interval,
    setInterval,
    priceDecimals,
  } = useChartView()

  // Show the skeleton until candle data actually renders, not while `loading` is
  // set: getHistory resolves synchronously from a cache, so `loading` never gives
  // the skeleton a visible window (a cold cache shows the animated skeleton until
  // the fetch lands; a warm cache flips through instantly — no fake delay).
  const showSkeleton = !noCandles && !hasCandleData && error === null
  const showError = !noCandles && error !== null

  return (
    <div className={styles.root}>
      <ChartHeader
        ohlc={crosshairOhlc}
        interval={interval}
        onIntervalChange={setInterval}
        priceDecimals={priceDecimals}
      />
      <div className={styles.body}>
        <div ref={containerRef} className={styles.canvasHost} />
        {liveBadge === 'paused' ? (
          <span className={styles.liveBadge}>live updates paused</span>
        ) : null}
        {noCandles ? <ChartUnavailableTile /> : null}
        {showSkeleton ? <ChartSkeleton /> : null}
        {showError ? <ChartErrorTile onRetry={retry} /> : null}
      </div>
    </div>
  )
}
