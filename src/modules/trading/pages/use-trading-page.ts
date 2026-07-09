import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useIsMobile } from '../../shared/hooks/use-is-mobile'
import { useTradingMode } from '@/modules/shared/providers/trading-mode-provider'
import { useSpectatedAddress } from '@/modules/spectate'
import { useSelectedMarketContext } from '../providers/selected-market-provider'
import type { UseTradingPageReturn } from './trading-page.types'

export function useTradingPage(): UseTradingPageReturn {
  const isMobile = useIsMobile()
  const { mode } = useTradingMode()
  const spectatedAddress = useSpectatedAddress()
  const { setSelectedMarket } = useSelectedMarketContext()

  // Simple mode only reshapes the mobile shell; desktop always renders the full
  // terminal, so the flag is gated on `isMobile` to keep the page branch honest.
  const isSimpleMode = isMobile && mode === 'simple'

  // Hide the viewport-fixed left-edge AI toggle while the AccountDock is scrolled
  // into the toggle's row (the toggle sits at viewport vertical centre), so it
  // never covers the dock table — then show it again over the chart. A 0-height
  // IntersectionObserver trip-line at viewport centre (`-50%` top+bottom margins)
  // flips the flag the moment the dock crosses it. Guarded for jsdom/SSR (no IO)
  // and desktop-only (the toggle is not mounted on mobile).
  const dockRef = useRef<HTMLDivElement | null>(null)
  const [isAiToggleHidden, setIsAiToggleHidden] = useState(false)
  useEffect(() => {
    const dock = dockRef.current
    if (isMobile || !dock || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setIsAiToggleHidden(entries[0]?.isIntersecting ?? false),
      { rootMargin: '-50% 0px -50% 0px' },
    )
    observer.observe(dock)
    return () => observer.disconnect()
  }, [isMobile])
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
    isSimpleMode,
    spectatedAddress,
    setSelectedMarket,
    mobileHeaderControls,
    isOrderSheetOpen,
    openOrderSheet,
    closeOrderSheet,
    dockRef,
    isAiToggleHidden,
  }
}
