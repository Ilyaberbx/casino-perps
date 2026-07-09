import type { ConnectionStatus } from '@/modules/shared/domain'
import type { ConnectionDotColor } from './connection-status-bar.types'

const ADDRESS_TAIL_LENGTH = 5

export function resolveNetworkLabel(venueMetadataId: string): string {
  const isHyperliquidMainnet = venueMetadataId === 'hyperliquid:mainnet'
  const isHyperliquidTestnet = venueMetadataId === 'hyperliquid:testnet'

  if (isHyperliquidMainnet) return 'Mainnet'
  if (isHyperliquidTestnet) return 'Testnet'
  return 'Mock'
}

export function resolveDotColor(status: ConnectionStatus): ConnectionDotColor {
  const isGreen = status === 'connected'
  const isRed = status === 'disconnected' || status === 'error'

  if (isGreen) return 'green'
  if (isRed) return 'red'
  return 'amber'
}

export function resolveAddressTail(address: string): string {
  return address.slice(-ADDRESS_TAIL_LENGTH)
}
