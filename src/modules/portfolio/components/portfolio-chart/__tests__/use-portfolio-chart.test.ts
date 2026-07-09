import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { ThemeProvider } from '../../../../shared/providers/theme-provider'
import { usePortfolioChart } from '../use-portfolio-chart'
import type { PortfolioChartState } from '../portfolio-chart.types'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ThemeProvider, null, children)
}

function renderPortfolioChart(props: Parameters<typeof usePortfolioChart>[0]) {
  return renderHook(() => usePortfolioChart(props), { wrapper })
}

const readyState: PortfolioChartState = {
  kind: 'ready',
  points: [
    { timestamp: 1_715_644_800_000, value: 13.11 },
    { timestamp: 1_715_731_200_000, value: 13.18 },
  ],
}

const loadingState: PortfolioChartState = { kind: 'loading' }

describe('usePortfolioChart', () => {
  it('returns null data when state is not ready', () => {
    const { result } = renderPortfolioChart({
      state: loadingState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    expect(result.current.data).toBeNull()
  })

  it('returns one smooth monotone line dataset with origin fill when ready', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    expect(result.current.data?.datasets).toHaveLength(1)
    const ds = result.current.data!.datasets[0]
    expect(ds.stepped).toBeUndefined()
    expect(ds.cubicInterpolationMode).toBe('monotone')
    expect(ds.fill).toBe('origin')
    expect(ds.tension).toBe(0)
    expect(ds.borderWidth).toBe(2)
    expect(ds.pointRadius).toBe(0)
    expect(ds.pointHoverRadius).toBe(4)
  })

  it('resamples a sparse series up to the smooth target point count', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    // readyState has 2 raw knots; the dense series spans the smooth target.
    expect(result.current.data?.labels).toHaveLength(160)
  })

  it('registers the four custom plugins in draw order (zero-baseline, line glow, crosshair, end-value pin)', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'pnl',
      window: '7D',
    })
    expect(result.current.plugins).toHaveLength(4)
    const ids = result.current.plugins.map((plugin) => plugin.id)
    expect(ids).toEqual([
      'portfolioZeroBaseline',
      'portfolioLineGlow',
      'portfolioCrosshair',
      'portfolioEndValuePin',
    ])
  })

  it('enables both axes with display: true and shows grid lines without tick marks', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    const scales = result.current.options.scales
    expect(scales?.x?.display).toBe(true)
    expect(scales?.y?.display).toBe(true)
    expect(scales?.x?.grid?.display).toBe(true)
    expect(scales?.y?.grid?.display).toBe(true)
    expect(scales?.x?.grid?.drawTicks).toBe(false)
    expect(scales?.y?.grid?.drawTicks).toBe(false)
  })

  it('configures interaction in x-index mode for crosshair behavior', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    expect(result.current.options.interaction?.mode).toBe('index')
    expect(result.current.options.interaction?.intersect).toBe(false)
    expect(result.current.options.interaction?.axis).toBe('x')
  })

  it('keeps tooltip transitions instant (no animation on hover)', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    const transitions = result.current.options.transitions
    expect(transitions?.active?.animation?.duration).toBe(0)
  })

  it('sweeps the line in left-to-right on initial draw via per-point reveal', () => {
    const { result } = renderPortfolioChart({
      state: readyState,
      tone: 'neutral',
      metric: 'accountValue',
      window: '7D',
    })
    const animation = result.current.options.animation
    expect(animation).toMatchObject({ duration: 600, easing: 'easeOutQuart' })
    // The x property starts each dense sample skipped (NaN) and reveals it on a
    // scriptable per-point delay — that is what produces the left-to-right draw-on.
    const xAnimation = result.current.options.animations?.x
    if (!xAnimation) throw new Error('expected an x-property entry animation')
    expect(xAnimation).toMatchObject({ type: 'number', from: NaN })
    expect(typeof xAnimation.delay).toBe('function')
  })
})
