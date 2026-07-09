import type { Plugin } from 'chart.js'
import type { PortfolioChartColors } from './portfolio-chart.utils'
import { formatPortfolioValue, withAlpha } from './portfolio-chart.utils'
import type { PortfolioChartMetric } from './portfolio-chart.types'

export interface ChartPluginContext {
  metric: PortfolioChartMetric
  stroke: string
  colors: PortfolioChartColors
  drawZeroBaseline: boolean
}

const CROSSHAIR_PLUGIN_ID = 'portfolioCrosshair'
const END_VALUE_PIN_PLUGIN_ID = 'portfolioEndValuePin'
const ZERO_BASELINE_PLUGIN_ID = 'portfolioZeroBaseline'
const LINE_GLOW_PLUGIN_ID = 'portfolioLineGlow'

const HOVER_HALO_RADIUS_PX = 9
const HOVER_POINT_SIZE_PX = 8
const GLOW_BLUR_PX = 12
const GLOW_ALPHA = 0.9

export function createLineGlowPlugin(ctx: ChartPluginContext): Plugin<'line'> {
  return {
    id: LINE_GLOW_PLUGIN_ID,
    afterDatasetsDraw(chart) {
      const points = chart.getDatasetMeta(0).data
      if (points.length < 2) return
      const { ctx: canvas } = chart

      // Re-stroke the rendered polyline with a canvas shadow to bloom the line
      // only — setting the shadow around the whole dataset draw would also blur
      // the gradient fill's edge. The crisp line Chart.js already drew stays on
      // top; this pass adds the surrounding glow in the series tone.
      canvas.save()
      canvas.shadowColor = withAlpha(ctx.stroke, GLOW_ALPHA)
      canvas.shadowBlur = GLOW_BLUR_PX
      canvas.strokeStyle = ctx.stroke
      canvas.lineWidth = 2
      canvas.lineJoin = 'round'
      canvas.lineCap = 'round'
      canvas.beginPath()

      // Trace only the points the entry animation has revealed so far: un-started
      // points carry a NaN x (dataset `from: NaN`), so the glow extends exactly as
      // far as the left-to-right sweep — the reveal is contiguous, so stop at the
      // first non-finite point.
      const first = points[0]
      if (!Number.isFinite(first.x) || !Number.isFinite(first.y)) {
        canvas.restore()
        return
      }
      canvas.moveTo(first.x, first.y)
      for (let index = 1; index < points.length; index += 1) {
        const point = points[index]
        const isDrawn = Number.isFinite(point.x) && Number.isFinite(point.y)
        if (!isDrawn) break
        canvas.lineTo(point.x, point.y)
      }
      canvas.stroke()
      canvas.restore()
    },
  }
}

export function createCrosshairPlugin(ctx: ChartPluginContext): Plugin<'line'> {
  return {
    id: CROSSHAIR_PLUGIN_ID,
    afterDatasetsDraw(chart) {
      const tooltip = chart.tooltip
      if (!tooltip) return
      const active = tooltip.getActiveElements()
      if (active.length === 0) return
      const element = active[0].element
      const x = element.x
      const y = element.y
      const hasValidPosition = Number.isFinite(x) && Number.isFinite(y)
      if (!hasValidPosition) return

      const { ctx: canvas, chartArea } = chart
      canvas.save()

      // Full crosshair: thin neutral hairlines on both axes — a terminal-native
      // guide, not a colored mark (the teal accent is reserved for active/live).
      canvas.strokeStyle = withAlpha(ctx.colors.borderStrong, 0.55)
      canvas.lineWidth = 1
      canvas.beginPath()
      canvas.moveTo(x, chartArea.top)
      canvas.lineTo(x, chartArea.bottom)
      canvas.moveTo(chartArea.left, y)
      canvas.lineTo(chartArea.right, y)
      canvas.stroke()

      // Soft "lit" halo behind the hovered point, in the series tone.
      const halo = canvas.createRadialGradient(x, y, 0, x, y, HOVER_HALO_RADIUS_PX)
      halo.addColorStop(0, withAlpha(ctx.stroke, 0.28))
      halo.addColorStop(1, withAlpha(ctx.stroke, 0))
      canvas.fillStyle = halo
      canvas.beginPath()
      canvas.arc(x, y, HOVER_HALO_RADIUS_PX, 0, Math.PI * 2)
      canvas.fill()

      // Crisp square hover point (keeps the pixel/data identity) with a contrast
      // ring so it reads above the halo and the line.
      const half = HOVER_POINT_SIZE_PX / 2
      canvas.fillStyle = ctx.stroke
      canvas.fillRect(x - half, y - half, HOVER_POINT_SIZE_PX, HOVER_POINT_SIZE_PX)
      canvas.lineWidth = 2
      canvas.strokeStyle = ctx.colors.surfaceElevated
      canvas.strokeRect(x - half, y - half, HOVER_POINT_SIZE_PX, HOVER_POINT_SIZE_PX)

      canvas.restore()
    },
  }
}

export function createEndValuePinPlugin(ctx: ChartPluginContext): Plugin<'line'> {
  return {
    id: END_VALUE_PIN_PLUGIN_ID,
    afterDatasetsDraw(chart) {
      const tooltipActive = (chart.tooltip?.getActiveElements().length ?? 0) > 0
      if (tooltipActive) return
      const meta = chart.getDatasetMeta(0)
      const points = meta.data
      if (points.length === 0) return
      const last = points[points.length - 1]
      const rawValue = chart.data.datasets[0].data[points.length - 1]
      const value = typeof rawValue === 'number' ? rawValue : null
      if (value === null) return
      if (!Number.isFinite(last.x) || !Number.isFinite(last.y)) return
      const label = formatPortfolioValue(ctx.metric, value)
      const { ctx: canvas, chartArea } = chart
      canvas.save()
      canvas.font = '600 11px "General Sans", system-ui, sans-serif'
      canvas.textBaseline = 'middle'
      canvas.textAlign = 'left'

      // Right-edge price tag: a bordered chip in the series tone — the last-value
      // marker familiar from trading terminals, sitting in the reserved right pad.
      const tagPaddingX = 6
      const tagHeight = 18
      const gapFromLine = 8
      const cornerRadius = 4
      const textWidth = canvas.measureText(label).width
      const tagWidth = textWidth + tagPaddingX * 2
      const maxTagX = chart.width - tagWidth - 2
      const tagX = Math.min(last.x + gapFromLine, maxTagX)
      const centerY = Math.max(
        chartArea.top + tagHeight / 2,
        Math.min(last.y, chartArea.bottom - tagHeight / 2),
      )
      const tagY = centerY - tagHeight / 2

      canvas.beginPath()
      canvas.roundRect(tagX, tagY, tagWidth, tagHeight, cornerRadius)
      canvas.fillStyle = ctx.colors.surfaceElevated
      canvas.fill()
      canvas.lineWidth = 1
      canvas.strokeStyle = ctx.stroke
      canvas.stroke()

      canvas.fillStyle = ctx.stroke
      canvas.fillText(label, tagX + tagPaddingX, centerY)
      canvas.restore()
    },
  }
}

export function createZeroBaselinePlugin(ctx: ChartPluginContext): Plugin<'line'> {
  return {
    id: ZERO_BASELINE_PLUGIN_ID,
    beforeDatasetsDraw(chart) {
      if (!ctx.drawZeroBaseline) return
      const yScale = chart.scales.y
      if (!yScale) return
      const zeroY = yScale.getPixelForValue(0)
      if (!Number.isFinite(zeroY)) return
      const { ctx: canvas, chartArea } = chart
      const isInsideArea = zeroY >= chartArea.top && zeroY <= chartArea.bottom
      if (!isInsideArea) return
      canvas.save()
      canvas.strokeStyle = withAlpha(ctx.colors.borderStrong, 0.6)
      canvas.lineWidth = 1
      canvas.setLineDash([4, 4])
      canvas.beginPath()
      canvas.moveTo(chartArea.left, zeroY)
      canvas.lineTo(chartArea.right, zeroY)
      canvas.stroke()
      canvas.restore()
    },
  }
}
