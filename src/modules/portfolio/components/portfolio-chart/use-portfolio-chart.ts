import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  TimeScale,
} from 'chart.js'
import type { ChartData, ChartOptions, Plugin, ScriptableContext } from 'chart.js'
import {
  densifyPortfolioPoints,
  formatPortfolioValue,
  formatTickLabel,
  formatTooltipTitle,
  isSignedMetric,
  pickXTickIndices,
  pointsTimeSpan,
  prefersReducedMotion,
  resolvePortfolioChartColors,
  withAlpha,
} from './portfolio-chart.utils'
import { ENTRY_DURATION_MS, SMOOTH_TARGET_POINTS } from './portfolio-chart.constants'
import {
  createCrosshairPlugin,
  createEndValuePinPlugin,
  createLineGlowPlugin,
  createZeroBaselinePlugin,
} from './portfolio-chart.plugins'
import { useThemeContext } from '../../../shared/providers/theme-provider'
import type {
  PortfolioChartMetric,
  PortfolioChartProps,
  PortfolioChartTone,
} from './portfolio-chart.types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  TimeScale,
)

interface UsePortfolioChartReturn {
  data: ChartData<'line'> | null
  options: ChartOptions<'line'>
  plugins: Plugin<'line'>[]
}

function strokeFor(tone: PortfolioChartTone, accent: string, up: string, down: string): string {
  if (tone === 'up') return up
  if (tone === 'down') return down
  return accent
}

export function usePortfolioChart(
  props: Pick<PortfolioChartProps, 'state' | 'tone' | 'metric' | 'window'>,
): UsePortfolioChartReturn {
  const { state, tone = 'neutral', metric, window: portfolioWindow } = props
  const { theme } = useThemeContext()

  return useMemo(() => {
    const colors = resolvePortfolioChartColors(theme)
    const stroke = strokeFor(tone, colors.accent, colors.directionUp, colors.directionDown)
    const fillTop = withAlpha(stroke, 0.34)
    const fillMid = withAlpha(stroke, 0.1)
    const fillBottom = withAlpha(stroke, 0.0)
    const gridColor = withAlpha(colors.textMuted, 0.12)

    const isReady = state.kind === 'ready'
    const rawPoints = isReady ? state.points : []
    // Resample the sparse venue series to a dense, time-uniform set so the line
    // reads smooth (not blocky) and the X ticks sit at even clock-time intervals.
    const points = densifyPortfolioPoints(rawPoints, SMOOTH_TARGET_POINTS)
    // Vertical grid lines land exactly under the labeled ticks — one line per
    // label — rather than a denser, misaligned cadence.
    const tickIndices = new Set<number>(pickXTickIndices(portfolioWindow, points.length))
    const span = pointsTimeSpan(points)
    const drawZeroBaseline = isSignedMetric(metric)

    const data: ChartData<'line'> | null = isReady
      ? {
          labels: points.map((point) => point.timestamp),
          datasets: [
            {
              data: points.map((point) => point.value),
              borderColor: stroke,
              backgroundColor: (scriptableCtx: ScriptableContext<'line'>) => {
                const chart = scriptableCtx.chart
                const { chartArea, ctx: canvas } = chart
                if (!chartArea) return fillTop
                const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                gradient.addColorStop(0, fillTop)
                gradient.addColorStop(0.55, fillMid)
                gradient.addColorStop(1, fillBottom)
                return gradient
              },
              borderWidth: 2,
              borderCapStyle: 'round',
              borderJoinStyle: 'round',
              pointStyle: 'rect',
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: stroke,
              pointHoverBorderColor: colors.surfaceElevated,
              pointHoverBorderWidth: 2,
              tension: 0,
              cubicInterpolationMode: 'monotone',
              fill: 'origin',
            },
          ],
        }
      : null

    const tickFontFamily = '"General Sans", system-ui, sans-serif'

    const reduceMotion = prefersReducedMotion()

    // Left-to-right draw-on entry: each dense sample starts after the one before
    // it (`dataIndex * stepMs`), its x revealed from NaN (skipped → drawn) and its
    // y grown from the previous point's final pixel. With `fill: 'origin'` the
    // gradient area sweeps in behind the line for free. Total wall-clock is
    // `pointCount * stepMs === ENTRY_DURATION_MS`.
    const pointCount = points.length
    const stepMs = pointCount > 0 ? ENTRY_DURATION_MS / pointCount : 0
    const delayForPoint = (scriptableCtx: ScriptableContext<'line'>): number => {
      const isDataPoint = scriptableCtx.type === 'data'
      return isDataPoint ? scriptableCtx.dataIndex * stepMs : 0
    }
    const previousPointY = (scriptableCtx: ScriptableContext<'line'>): number => {
      const yScale = scriptableCtx.chart.scales.y
      const isDataPoint = scriptableCtx.type === 'data'
      const previousIndex = isDataPoint ? Math.max(0, scriptableCtx.dataIndex - 1) : 0
      const previousValue = points[previousIndex]?.value
      const hasValue = typeof previousValue === 'number'
      return yScale.getPixelForValue(hasValue ? previousValue : 0)
    }

    const entryAnimation: ChartOptions<'line'>['animation'] = reduceMotion
      ? { duration: 0 }
      : { duration: ENTRY_DURATION_MS, easing: 'easeOutQuart' }
    const entryAnimations: ChartOptions<'line'>['animations'] = reduceMotion
      ? { colors: { duration: 0 }, x: { duration: 0 }, y: { duration: 0 } }
      : {
          colors: { duration: 0 },
          x: { type: 'number', easing: 'linear', duration: stepMs, from: NaN, delay: delayForPoint },
          y: {
            type: 'number',
            easing: 'linear',
            duration: stepMs,
            from: previousPointY,
            delay: delayForPoint,
          },
        }

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: entryAnimation,
      animations: entryAnimations,
      // Hover and resize never replay the entry sweep — both transitions render
      // instantly; only the initial mount (and the keyed metric/window remount)
      // runs the per-point draw-on configured above.
      transitions: {
        active: { animation: { duration: 0 } },
        resize: { animation: { duration: 0 } },
      },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      hover: { mode: 'index', intersect: false },
      layout: { padding: { top: 12, right: 64, bottom: 18, left: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: colors.surfaceElevated,
          borderColor: stroke,
          borderWidth: 2,
          titleColor: colors.text,
          bodyColor: colors.text,
          titleFont: { family: 'General Sans', weight: 600, size: 11 },
          titleMarginBottom: 6,
          bodyFont: { family: 'General Sans', weight: 600, size: 12 },
          padding: { x: 11, y: 9 },
          // Floating chrome rounds (ADR-0043 radius-sm); the line keeps its
          // square data point.
          cornerRadius: 4,
          displayColors: false,
          caretSize: 0,
          callbacks: {
            title: (items) => {
              const first = items[0]
              if (!first) return ''
              const label = first.label
              const ts = typeof label === 'string' ? Number(label) : Number(label)
              if (!Number.isFinite(ts)) return ''
              return formatTooltipTitle(ts)
            },
            label: (item) => {
              const value = item.parsed.y
              if (typeof value !== 'number') return ''
              return `${labelForMetric(metric)}  ${formatPortfolioValue(metric, value)}`
            },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          grid: {
            display: true,
            drawTicks: false,
            color: (ctx) => (tickIndices.has(ctx.index) ? gridColor : 'rgba(0,0,0,0)'),
            lineWidth: 1,
          },
          border: { display: false },
          ticks: {
            color: colors.textMuted,
            font: { family: tickFontFamily, size: 10 },
            maxRotation: 0,
            autoSkip: false,
            padding: 14,
            callback: (_value, index) => {
              if (!tickIndices.has(index)) return ''
              const point = points[index]
              if (!point) return ''
              return formatTickLabel(portfolioWindow, point.timestamp, span)
            },
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            display: true,
            drawTicks: false,
            color: gridColor,
            lineWidth: 1,
          },
          border: { display: false },
          ticks: {
            color: colors.textMuted,
            font: { family: tickFontFamily, size: 10 },
            maxTicksLimit: 9,
            padding: 12,
            callback: (value) => {
              if (typeof value !== 'number') return ''
              return formatPortfolioValue(metric, value)
            },
          },
          beginAtZero: false,
        },
      },
      elements: {
        line: { borderColor: stroke, borderCapStyle: 'round', borderJoinStyle: 'round' },
      },
    }

    const pluginCtx = { metric, stroke, colors, drawZeroBaseline }
    const plugins: Plugin<'line'>[] = [
      createZeroBaselinePlugin(pluginCtx),
      createLineGlowPlugin(pluginCtx),
      createCrosshairPlugin(pluginCtx),
      createEndValuePinPlugin(pluginCtx),
    ]

    return { data, options, plugins }
  }, [state, tone, metric, portfolioWindow, theme])
}

function labelForMetric(metric: PortfolioChartMetric): string {
  if (metric === 'accountValue') return 'Account Value'
  if (metric === 'pnl') return 'PNL'
  return 'Perps PNL'
}
