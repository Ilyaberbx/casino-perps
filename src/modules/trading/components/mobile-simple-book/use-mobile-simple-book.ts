import { useBookTradeControls } from '../../hooks/use-book-trade-controls'
import type { UseMobileSimpleBookReturn } from './mobile-simple-book.types'

/**
 * Feeds the combined Simple-mode panel the same market-derived defaults the pro
 * book/trades views use (native tick, base size denomination, base/quote
 * symbols), minus the picker state — Simple mode exposes no controls.
 */
export function useMobileSimpleBook(): UseMobileSimpleBookReturn {
  const { tick, sizeAsset, baseSymbol, quoteSymbol } = useBookTradeControls()
  return { tick, sizeAsset, baseSymbol, quoteSymbol }
}
