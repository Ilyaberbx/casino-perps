export type BookTradesTab = 'order-book' | 'trades'

/** Which asset the size/total columns are denominated in. */
export type SizeAsset = 'base' | 'quote'

/**
 * Which side(s) of the order book to render. `both` shows asks + spread + bids,
 * `bids` shows a spread-topped bid ladder, `asks` shows a spread-footed ask
 * ladder (matches nado.xyz's 3-way side picker).
 */
export type BookSide = 'both' | 'bids' | 'asks'

/** Props for the reusable both/bids/asks side picker (desktop + mobile). */
export interface BookSidePickerProps {
  value: BookSide
  onChange: (side: BookSide) => void
}

export interface UseBookTradesPanelReturn {
  activeTab: BookTradesTab
  setActiveTab: (tab: BookTradesTab) => void
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
