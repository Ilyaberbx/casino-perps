import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/account'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import type { ConnectionStatus } from '@/modules/shared/domain'
import { resolveNetworkLabel, resolveDotColor, resolveAddressTail } from './connection-status-bar.utils'
import type { UseConnectionStatusBarReturn } from './connection-status-bar.types'

export function useConnectionStatusBar(): UseConnectionStatusBarReturn {
  const { primaryWalletAddress } = useAuth()
  const venue = useVenue()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    venue.capabilities.connection.status(),
  )

  useEffect(() => {
    const unsubscribe = venue.capabilities.connection.subscribe((status) => {
      setConnectionStatus(status)
    })
    return unsubscribe
  }, [venue.capabilities.connection])

  const networkLabel = resolveNetworkLabel(venue.metadata.id)
  const dotColor = resolveDotColor(connectionStatus)
  const addressTail = primaryWalletAddress
    ? resolveAddressTail(primaryWalletAddress)
    : null

  return { networkLabel, connectionStatus, dotColor, addressTail }
}
