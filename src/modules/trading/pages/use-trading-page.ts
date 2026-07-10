import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useIsMobile } from '../../shared/hooks/use-is-mobile'
import { useSpectatedAddress } from '@/modules/spectate'
import { useSelectedMarketContext } from '../providers/selected-market-provider'
import type { UseTradingPageReturn } from './trading-page.types'

export function useTradingPage(): UseTradingPageReturn {
  const isMobile = useIsMobile()
  const spectatedAddress = useSpectatedAddress()
  const { setSelectedMarket } = useSelectedMarketContext()

  // App-level mobile header controls (venue switcher + spectate) handed down by
  // `AppShell` via Outlet context — rendered in the page's own mobile header row
  // so they share one bar with the market strip. Null on desktop / when rendered
  // outside the AppShell Outlet (e.g. unit tests).
  const outlet = useOutletContext<{ mobileHeaderControls?: ReactNode } | null>()
  const mobileHeaderControls = outlet?.mobileHeaderControls ?? null
  // On mobile the order ticket is no longer an inline card — a header Place Order
  // button opens it in a bottom `Sheet` (the order-entry window). Both the button
  // and the sheet live in `TradingPage`, so the open state is owned here.
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false)
  const openOrderSheet = useCallback(() => setIsOrderSheetOpen(true), [])
  const closeOrderSheet = useCallback(() => setIsOrderSheetOpen(false), [])
  return {
    isMobile,
    spectatedAddress,
    setSelectedMarket,
    mobileHeaderControls,
    isOrderSheetOpen,
    openOrderSheet,
    closeOrderSheet,
  }
}
