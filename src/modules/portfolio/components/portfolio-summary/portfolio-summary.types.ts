import type { PortfolioSnapshot } from '../../../shared/domain'

export type DirectionTone = 'up' | 'down' | 'neutral'

export interface PortfolioSummaryProps {
  snapshot: PortfolioSnapshot | null
}

export interface SummaryTileProps {
  label: string
  value: string
  tone: DirectionTone
}
