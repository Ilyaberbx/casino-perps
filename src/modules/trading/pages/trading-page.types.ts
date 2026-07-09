import type { ReactNode, RefObject } from 'react'

export interface UseTradingPageReturn {
  isMobile: boolean
  /** True on mobile when the user chose the `simple` trade layout — the page
   *  renders a bare chart instead of the chart/book/trades tab terminal. Always
   *  false on desktop (simple mode reshapes the mobile shell only). */
  isSimpleMode: boolean
  /** Active Spectated Address (or null) — keys the account dock so it refreshes per spectated user. */
  spectatedAddress: string | null
  /** Loads a market on the chart — wired to the account dock so clicking a position selects its market. */
  setSelectedMarket: (symbol: string) => void
  /** App-level controls (venue switcher + spectate) injected by `AppShell` via
   * Outlet context, rendered in the mobile header row. Null on desktop / tests. */
  mobileHeaderControls: ReactNode
  /** Whether the mobile Place Order window (the order-entry `Sheet`) is open. */
  isOrderSheetOpen: boolean
  /** Opens the mobile Place Order window. */
  openOrderSheet: () => void
  /** Closes the mobile Place Order window. */
  closeOrderSheet: () => void
  /** Ref attached to the desktop AccountDock pane — observed to hide the AI toggle
   *  while the dock is scrolled into the toggle's row (so it never covers it). */
  dockRef: RefObject<HTMLDivElement | null>
  /** Whether the left-edge AI toggle is currently slid off (dock under it). */
  isAiToggleHidden: boolean
}
