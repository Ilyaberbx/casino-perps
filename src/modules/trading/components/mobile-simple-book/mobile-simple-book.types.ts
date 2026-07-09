import type { SizeAsset } from '../book-trades-panel/book-trades-panel.types'

/**
 * The slice the combined Simple-mode book+trades panel needs from
 * `useBookTradeControls`. Simple mode renders no tick/size pickers, so it reads
 * the defaults (native tick, base denomination) and never the setters.
 */
export interface UseMobileSimpleBookReturn {
  tick: number
  sizeAsset: SizeAsset
  baseSymbol: string
  quoteSymbol: string
}
