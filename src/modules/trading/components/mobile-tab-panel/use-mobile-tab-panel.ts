import { useState, useCallback } from 'react'
import type { MobileTab, SizeOption, TickOption, UseMobileTabPanelReturn } from './mobile-tab-panel.types'
import { DEFAULT_MOBILE_TAB } from './mobile-tab-panel.constants'
import { useBookTradeControls } from '../../hooks/use-book-trade-controls'
import { formatTick } from '../orderbook/orderbook.utils'

export function useMobileTabPanel(): UseMobileTabPanelReturn {
  const [activeTab, setActiveTabState] = useState<MobileTab>(DEFAULT_MOBILE_TAB)

  const setActiveTab = useCallback((tab: MobileTab) => {
    setActiveTabState(tab)
  }, [])

  const controls = useBookTradeControls()

  const tickOptions: ReadonlyArray<TickOption> = controls.tickLadder.map((option) => ({
    value: String(option),
    label: formatTick(option),
  }))

  const sizeOptions: ReadonlyArray<SizeOption> = [
    { value: 'base', label: controls.baseSymbol },
    { value: 'quote', label: controls.quoteSymbol },
  ]

  const isChartVisible = activeTab === 'chart'
  const isOrderbookVisible = activeTab === 'orderbook'
  const isTradesVisible = activeTab === 'trades'

  return {
    activeTab,
    setActiveTab,
    ...controls,
    tickOptions,
    sizeOptions,
    isChartVisible,
    isOrderbookVisible,
    isTradesVisible,
  }
}
