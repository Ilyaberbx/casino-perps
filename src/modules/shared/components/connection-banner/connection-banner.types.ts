import type { ConnectionHealth } from '../../services/connection-supervisor'

export interface ConnectionBannerViewModel {
  readonly visible: boolean
  readonly health: Exclude<ConnectionHealth, 'healthy'>
  readonly label: string
  readonly hint: string
  readonly isReconnecting: boolean
  readonly onReconnect: () => void
}
