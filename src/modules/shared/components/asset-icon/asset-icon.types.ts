import type { Market } from '@/modules/shared/domain/domain.types'

// TODO: Market will have marketType/hlCoin after Phase 2 lands (already present in domain.types.ts as optional fields)

export interface AssetIconProps {
  market: Market
  size?: number
}

export interface LetterPlaceholderProps {
  letter: string
  size: number
}

export interface UseAssetIconReturn {
  src: string | null
  hasError: boolean
  onError: () => void
  isDarkFill: boolean
}

// IconResolution is defined and exported from resolve-market-icon-url.ts.
// Re-exported here for convenience of consumers within the asset-icon folder.
export type { IconResolution } from '@/modules/shared/utils/resolve-market-icon-url'
