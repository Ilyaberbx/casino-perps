import { useConnectionRecoveryOptional } from '../../providers/connection-recovery'
import type { ConnectionBannerViewModel } from './connection-banner.types'

const LABEL_BY_HEALTH = {
  degraded: 'CONNECTION DEGRADED',
  dead: 'CONNECTION LOST',
} as const

const HIDDEN_VIEW: ConnectionBannerViewModel = {
  visible: false,
  health: 'degraded',
  label: '',
  hint: '',
  isReconnecting: false,
  onReconnect: () => {},
}

function buildHint(stallSeconds: number | null, isDead: boolean): string {
  if (isDead) return 'Live data has stopped flowing. Click reconnect to recover.'
  if (stallSeconds !== null && stallSeconds >= 5) {
    return `No data for ${stallSeconds}s. Reconnecting…`
  }
  return 'Backing off and retrying. You can also reconnect now.'
}

export function useConnectionBanner(): ConnectionBannerViewModel {
  const recovery = useConnectionRecoveryOptional()

  // No provider (e.g. in isolated routing tests) → banner is inert.
  if (recovery === null) return HIDDEN_VIEW

  const { health, stallSeconds, isReconnecting, reconnect } = recovery

  const isHealthy = health === 'healthy'
  if (isHealthy) {
    return {
      visible: false,
      health: 'degraded',
      label: '',
      hint: '',
      isReconnecting: false,
      onReconnect: reconnect,
    }
  }

  return {
    visible: true,
    health,
    label: LABEL_BY_HEALTH[health],
    hint: buildHint(stallSeconds, health === 'dead'),
    isReconnecting,
    onReconnect: reconnect,
  }
}
