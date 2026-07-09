import type { ConnectionStatus } from '@/modules/shared/domain'

export type ConnectionDotColor = 'green' | 'amber' | 'red'

export interface UseConnectionStatusBarReturn {
  networkLabel: string
  connectionStatus: ConnectionStatus
  dotColor: ConnectionDotColor
  addressTail: string | null
}
