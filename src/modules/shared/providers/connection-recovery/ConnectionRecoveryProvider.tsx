import { ConnectionRecoveryContext } from './connection-recovery.context'
import type { ConnectionRecoveryProviderProps } from './connection-recovery.types'

export function ConnectionRecoveryProvider({ value, children }: ConnectionRecoveryProviderProps) {
  return (
    <ConnectionRecoveryContext.Provider value={value}>
      {children}
    </ConnectionRecoveryContext.Provider>
  )
}
