import { createContext } from 'react'
import type { ConnectionRecoveryContextValue } from './connection-recovery.types'

export const ConnectionRecoveryContext = createContext<ConnectionRecoveryContextValue | null>(null)
