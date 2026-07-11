import type { ReactNode } from 'react'
import type { VenueOnboardingSheetActions } from '@/modules/shared/components/VenueOnboardingSheet'

/** Passed to route pages via `<Outlet context>`. The casino shell owns the
 * mobile chrome globally, so app-level header controls are no longer injected
 * per page — the slot stays for the existing trade page's compat but is `null`. */
export interface AppShellOutletContext {
  mobileHeaderControls: ReactNode
}

export interface UseAppShellReturn {
  authenticated: boolean
  isWalletConnected: boolean

  /** Market-search overlay (center magnifier + mobile "Markets" tab). */
  isSearchOpen: boolean
  openSearch: () => void
  closeSearch: () => void

  /** Mobile rail drawer (hamburger). */
  isMenuOpen: boolean
  openMenu: () => void
  closeMenu: () => void

  /** Mobile chat sheet (bottom-nav "Chat" tab). */
  isChatOpen: boolean
  openChat: () => void
  closeChat: () => void

  /** Opens Add Cash (deposit) and dismisses any open mobile drawer. */
  handleAddCash: () => void
  handleLogIn: () => void
  handleCreateAccount: () => void
  /** Desktop rail collapse — icon-only 76px rail when true. */
  isRailCollapsed: boolean
  handleCollapse: () => void

  /** Venue-onboarding sheet (funding / silent agent-wallet flow) plumbing. */
  isOnboardingSheetOpen: boolean
  closeOnboardingSheet: () => void
  onboardingSheetActions: VenueOnboardingSheetActions
}
