import type { MarketType } from '../domain/domain.types'

export type MarketKind = MarketType

export function getMarketKindFromSymbol(symbol: string): MarketKind {
  if (symbol.includes('/')) return 'spot'
  if (symbol.includes(':')) return 'hip3'
  return 'perp'
}

export function marketKindLabel(kind: MarketKind): string {
  if (kind === 'spot') return 'Spot'
  if (kind === 'hip3') return 'HIP-3'
  return 'Perps'
}
