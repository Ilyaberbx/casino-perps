import { useState } from 'react'
import type { BookTradesTab, UseBookTradesPanelReturn } from './book-trades-panel.types'
import { DEFAULT_TAB } from './book-trades-panel.constants'
import { useBookTradeControls } from '../../hooks/use-book-trade-controls'

export function useBookTradesPanel(): UseBookTradesPanelReturn {
  const [activeTab, setActiveTab] = useState<BookTradesTab>(DEFAULT_TAB)
  const controls = useBookTradeControls()
  return { activeTab, setActiveTab, ...controls }
}
