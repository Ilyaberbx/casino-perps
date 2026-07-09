import type { ConnectionStatus, Unsubscribe } from '../domain.types'

export interface ConnectionStatusSource {
  status(): ConnectionStatus
  subscribe(onChange: (status: ConnectionStatus) => void): Unsubscribe
}
