import type { PortfolioPoint, PortfolioSnapshot, PortfolioWindow } from '../shared/domain'
import { uniformPortfolioWindowValues } from '../shared/domain'

const WINDOW_DURATION_MS: Record<PortfolioWindow, number> = {
  '24H': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
  AllTime: 365 * 24 * 60 * 60 * 1000,
}

const ZERO_SERIES_POINT_COUNT = 24

export const ZERO_SNAPSHOT: PortfolioSnapshot = {
  accountValue: 0,
  pnl: uniformPortfolioWindowValues(0),
  perpsPnl: 0,
  volume: uniformPortfolioWindowValues(0),
  spotEquity: 0,
  perpsEquity: 0,
  fourteenDayVolume: 0,
  timestamp: 0,
}

export function flatZeroSeries(window: PortfolioWindow, now: number = Date.now()): PortfolioPoint[] {
  const duration = WINDOW_DURATION_MS[window]
  const start = now - duration
  const step = duration / (ZERO_SERIES_POINT_COUNT - 1)
  const points: PortfolioPoint[] = []
  for (let i = 0; i < ZERO_SERIES_POINT_COUNT; i += 1) {
    points.push({ timestamp: start + step * i, value: 0 })
  }
  return points
}
