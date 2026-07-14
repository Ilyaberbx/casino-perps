import { useCallback, useMemo, useState } from 'react'
import { useAuth, useIsWalletConnected, useOwnEquity } from '@/modules/account'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { useDepositSheet } from '@/modules/shared/providers/deposit-sheet-provider'
import { useSettings } from '@/modules/shared/providers/settings-provider'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import type { VenueOnboardingSheetActions } from '@/modules/shared/components/VenueOnboardingSheet'
import type { RailAction } from './left-rail'
import type { UseAppShellReturn } from './app-shell.types'

/**
 * Smart hook for the casino app shell. Owns the three overlay toggles (search,
 * mobile rail drawer, mobile chat), the money/auth actions, and the venue-
 * onboarding sheet plumbing carried over from the perps shell. The shell
 * component stays dumb and reads everything from here.
 */
export function useAppShell(): UseAppShellReturn {
  const { authenticated, openConnectModal, loginWithWallet } = useAuth()
  const isWalletConnected = useIsWalletConnected()
  const depositSheet = useDepositSheet()
  const onboardingSheet = useVenueOnboardingSheet()
  const settings = useSettings()

  // Read-only header balance (perp equity). Label only when there is a live
  // number to show; the loading flag drives the chip's shimmer.
  const ownEquity = useOwnEquity()
  const hasEquityToShow = authenticated && ownEquity.isConnected && ownEquity.isLoaded
  const equityLabel = hasEquityToShow ? formatUsd(ownEquity.equityUsd) : null
  const isEquityLoading = authenticated && ownEquity.isConnected && !ownEquity.isLoaded

  const [isSearchOpen, setSearchOpen] = useState(false)
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isChatOpen, setChatOpen] = useState(false)
  const [isRailCollapsed, setRailCollapsed] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const openChat = useCallback(() => setChatOpen(true), [])
  const closeChat = useCallback(() => setChatOpen(false), [])

  const handleAddCash = useCallback(() => {
    setMenuOpen(false)
    depositSheet.open()
  }, [depositSheet])

  const handleOpenSettings = useCallback(() => {
    setMenuOpen(false)
    settings.open()
  }, [settings])

  // The rail's action-kind items open in-app surfaces rather than navigating.
  // Settings is the only one today; the switch keeps the union exhaustive.
  const handleRailAction = useCallback(
    (action: RailAction) => {
      if (action === 'settings') handleOpenSettings()
    },
    [handleOpenSettings],
  )

  const handleLogIn = useCallback(() => {
    openConnectModal?.()
  }, [openConnectModal])

  // "Create Account" and "Log In" both route through Privy's modal — it hosts
  // signup and login. The magenta styling marks Create Account as the commit.
  const handleCreateAccount = useCallback(() => {
    openConnectModal?.()
  }, [openConnectModal])

  const handleCollapse = useCallback(() => {
    setRailCollapsed((collapsed) => !collapsed)
  }, [])

  const onboardingSheetActions = useMemo<VenueOnboardingSheetActions>(
    () => ({
      // The user is authenticated but the selected wallet is linked-not-connected;
      // resolving the grant means connecting it into the live Privy session
      // (ADR-0061), not re-opening login.
      reconnectWallet: () => {
        void loginWithWallet()
      },
      switchChain: () => undefined,
      reload: () => {
        window.location.reload()
      },
      confirmReset: (message: string) => window.confirm(message),
      // Sibling sheets must not stack: close onboarding, then open deposit.
      openDeposit: () => {
        onboardingSheet.close()
        depositSheet.open()
      },
    }),
    [loginWithWallet, onboardingSheet, depositSheet],
  )

  return {
    authenticated,
    isWalletConnected,
    equityLabel,
    isEquityLoading,
    isSearchOpen,
    openSearch,
    closeSearch,
    isMenuOpen,
    openMenu,
    closeMenu,
    isChatOpen,
    openChat,
    closeChat,
    handleAddCash,
    handleOpenSettings,
    handleRailAction,
    handleLogIn,
    handleCreateAccount,
    isRailCollapsed,
    handleCollapse,
    isOnboardingSheetOpen: onboardingSheet.isOpen,
    closeOnboardingSheet: onboardingSheet.close,
    onboardingSheetActions,
  }
}
