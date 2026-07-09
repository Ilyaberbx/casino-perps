import type { MarketKind } from '../../utils/get-market-kind'

export interface MarketKindTagProps {
  symbol: string
  /** Override the derived market kind. When omitted, kind is derived from `symbol`. */
  kind?: MarketKind
}
