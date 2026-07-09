import { useMemo, useState } from 'react'
import { useSelectedMarketContext } from '../providers/selected-market-provider'
import { buildTickLadder, defaultTickFromLadder } from '../components/orderbook/orderbook.utils'
import type { BookSide, SizeAsset } from '../components/book-trades-panel/book-trades-panel.types'

export interface UseBookTradeControlsReturn {
  tick: number
  setTick: (tick: number) => void
  tickLadder: ReadonlyArray<number>
  sizeAsset: SizeAsset
  setSizeAsset: (asset: SizeAsset) => void
  bookSide: BookSide
  setBookSide: (side: BookSide) => void
  baseSymbol: string
  quoteSymbol: string
}

/**
 * Shared orderbook/trades controls state — the active tick (price aggregation)
 * and the size denomination (base vs. quote). Used by both `BookTradesPanel`
 * (desktop split view) and `MobileTabPanel` (mobile per-section tabs) so the
 * pickers behave identically across layouts.
 *
 * Resets on market change: a tick chosen for one market's price scale rarely
 * makes sense on another. Reset is done in render via a previous-value tracker
 * — the React 19 idiom for derived state (React Compiler forbids setState in
 * an effect).
 */
export function useBookTradeControls(): UseBookTradeControlsReturn {
  const { market } = useSelectedMarketContext()

  const tickLadder = useMemo(
    () => buildTickLadder(market.tickSize, market.markPrice),
    [market.tickSize, market.markPrice],
  )
  const [tick, setTick] = useState<number>(() => defaultTickFromLadder(tickLadder))
  const [sizeAsset, setSizeAsset] = useState<SizeAsset>('base')
  const [bookSide, setBookSide] = useState<BookSide>('both')
  const [previousSymbol, setPreviousSymbol] = useState<string>(market.symbol)

  const isSymbolChanged = previousSymbol !== market.symbol
  if (isSymbolChanged) {
    setPreviousSymbol(market.symbol)
    setTick(defaultTickFromLadder(tickLadder))
    setSizeAsset('base')
    setBookSide('both')
  }

  const isTickStale = !isSymbolChanged && !tickLadder.includes(tick)
  if (isTickStale) {
    setTick(defaultTickFromLadder(tickLadder))
  }

  return {
    tick,
    setTick,
    tickLadder,
    sizeAsset,
    setSizeAsset,
    bookSide,
    setBookSide,
    baseSymbol: market.baseAsset,
    quoteSymbol: market.quoteAsset,
  }
}
