import { useContext } from 'react'
import { ConnectionRecoveryContext } from './connection-recovery.context'
import type { ConnectionRecoveryContextValue } from './connection-recovery.types'

export function useConnectionRecovery(): ConnectionRecoveryContextValue {
  const ctx = useContext(ConnectionRecoveryContext)
  if (!ctx) {
    throw new Error('useConnectionRecovery must be used within ConnectionRecoveryProvider')
  }
  return ctx
}
