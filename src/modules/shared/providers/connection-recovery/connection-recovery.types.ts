import type { ConnectionHealth } from '../../services/connection-supervisor'

export interface ConnectionRecoveryState {
  readonly health: ConnectionHealth
  readonly stallSeconds: number | null
  readonly degradedSinceMs: number | null
  /** True while a user-initiated or auto reconnect is in flight. */
  readonly isReconnecting: boolean
}

export interface ConnectionRecoveryContextValue extends ConnectionRecoveryState {
  /** Triggers a venue rebuild. Safe to call repeatedly. */
  readonly reconnect: () => void
}

export interface ConnectionRecoveryProviderProps {
  readonly value: ConnectionRecoveryContextValue
  readonly children: React.ReactNode
}
