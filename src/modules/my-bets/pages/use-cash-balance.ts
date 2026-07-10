import { useEffect, useState } from 'react'
import { useOwnCapability } from '@/modules/shared/providers/venue-provider'
import { useIsWalletConnected } from '@/modules/account'

/**
 * YOUR CASH — the User's own total account equity, read through the
 * Acting-Address-keyed `PortfolioReader` (`ownAccount.portfolio`) so it shows
 * self even while Spectating. Disconnected ⇒ `0` (empty-value wallet gate); a
 * venue without the capability also stays at `0`.
 */
export function useCashBalance(): { cashUsd: number; isConnected: boolean } {
  const portfolio = useOwnCapability('portfolio')
  const isConnected = useIsWalletConnected()
  const [cashUsd, setCashUsd] = useState(0)

  useEffect(() => {
    if (!portfolio) return
    if (!isConnected) return
    return portfolio.subscribeSnapshot('all', (snapshot) => {
      setCashUsd(snapshot.accountValue)
    })
  }, [portfolio, isConnected])

  if (!isConnected) return { cashUsd: 0, isConnected }
  return { cashUsd, isConnected }
}
