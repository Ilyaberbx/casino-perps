import type { BookSide, SizeAsset } from '../book-trades-panel/book-trades-panel.types'

export type MobileTab = 'chart' | 'orderbook' | 'trades'

export interface MobileTabOption {
  label: string
  value: MobileTab
}

export interface TickOption {
  value: string
  label: string
}

export interface SizeOption {
  value: SizeAsset
  label: string
}

export interface UseMobileTabPanelReturn {
  activeTab: MobileTab
  setActiveTab: (tab: MobileTab) => void
  tick: number
  setTick: (tick: number) => void
  tickLadder: ReadonlyArray<number>
  tickOptions: ReadonlyArray<TickOption>
  sizeAsset: SizeAsset
  setSizeAsset: (asset: SizeAsset) => void
  bookSide: BookSide
  setBookSide: (side: BookSide) => void
  baseSymbol: string
  quoteSymbol: string
  sizeOptions: ReadonlyArray<SizeOption>
  isChartVisible: boolean
  isOrderbookVisible: boolean
  isTradesVisible: boolean
}
