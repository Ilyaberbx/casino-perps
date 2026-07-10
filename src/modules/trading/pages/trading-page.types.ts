import type { ReactNode } from 'react'

export interface UseTradingPageReturn {
  isMobile: boolean
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
}
