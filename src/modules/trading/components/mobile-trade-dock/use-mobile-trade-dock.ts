import { useCallback } from 'react'
import { useAuth, useIsWalletConnected, useAccountModal } from '@/modules/account'
import { useSettings } from '@/modules/shared/providers/settings-provider'
import { usePerpSuggestionSheet } from '../../providers/perp-suggestion-sheet-provider'
import type { UseMobileTradeDockReturn } from './mobile-trade-dock.types'

/** Borrows the AI sheet's open handler from the provider and the account-modal
 * controller, so the footer's two action cells (Ask AI, Account) have something
 * to drive. Account opens the account modal when connected, else the
 * connect-wallet flow — the only place to set up a wallet on mobile. */
export function useMobileTradeDock(): UseMobileTradeDockReturn {
  const { open: openAskAi } = usePerpSuggestionSheet()
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

  return { openAskAi, openAccount, openSettings }
}
