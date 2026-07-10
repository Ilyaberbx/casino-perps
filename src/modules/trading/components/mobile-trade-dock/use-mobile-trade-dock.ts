import { useCallback } from 'react'
import { useAuth, useIsWalletConnected, useAccountModal } from '@/modules/account'
import { useSettings } from '@/modules/shared/providers/settings-provider'
import type { UseMobileTradeDockReturn } from './mobile-trade-dock.types'

/** Borrows the account-modal controller so the footer's Account cell has
 * something to drive. Account opens the account modal when connected, else the
 * connect-wallet flow — the only place to set up a wallet on mobile. */
export function useMobileTradeDock(): UseMobileTradeDockReturn {
  const { openConnectModal } = useAuth()
  const isWalletConnected = useIsWalletConnected()
  const accountModal = useAccountModal()
  const settings = useSettings()

  const openAccount = useCallback(() => {
    if (isWalletConnected) {
      accountModal.open()
      return
    }
    openConnectModal?.()
  }, [isWalletConnected, accountModal, openConnectModal])

  const openSettings = useCallback(() => {
    settings.open('appearance')
  }, [settings])

  return { openAccount, openSettings }
}
