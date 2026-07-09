import { Badge } from '../badge'
import { getMarketKindFromSymbol, marketKindLabel } from '../../utils/get-market-kind'
import type { BadgeTone } from '../badge'
import type { MarketKind } from '../../utils/get-market-kind'
import type { MarketKindTagProps } from './market-kind-tag.types'

const KIND_TONE: Record<MarketKind, BadgeTone> = {
  perp: 'directionUp',
  spot: 'accent',
  hip3: 'neutral',
}

export function MarketKindTag({ symbol, kind }: MarketKindTagProps) {
  const resolvedKind = kind ?? getMarketKindFromSymbol(symbol)
  const label = marketKindLabel(resolvedKind)
  return (
    <Badge tone={KIND_TONE[resolvedKind]} aria-label={`${label} market`}>
      {label}
    </Badge>
  )
}
