import { useContext } from 'react'
import { ConnectionRecoveryContext } from './connection-recovery.context'
import type { ConnectionRecoveryContextValue } from './connection-recovery.types'

/**
 * Returns the recovery context value when mounted, or null when no provider is
 * in the tree. Used by passive surfaces (the connection banner) that may be
 * rendered in test contexts (routing harness) where wiring the supervisor adds
 * noise without value — the banner simply hides.
 */
export function useConnectionRecoveryOptional(): ConnectionRecoveryContextValue | null {
  return useContext(ConnectionRecoveryContext)
}
