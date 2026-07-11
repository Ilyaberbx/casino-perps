import type { Market } from '@/modules/shared/domain/domain.types'
import { buildIconCandidateUrls } from '@/modules/shared/utils/resolve-market-icon-url'
import { useIconLadder } from '@/modules/shared/hooks/use-icon-ladder'
import { DARK_FILL_ICON_COINS } from '@/modules/shared/constants/tradingview-icon-map.constants'
import type { UseAssetIconReturn } from './asset-icon.types'

/**
 * Smart hook for AssetIcon — owns all state, derived values, and handlers.
 *
 * The fallback ladder is a flat ordered candidate list (the shared
 * `buildIconCandidateUrls`), walked by the shared `useIconLadder`: each
 * `onError` advances one rung; running off the end renders the letter
 * placeholder. The market identity keys the ladder so changing markets resets
 * it without a setState-in-effect.
 *
 * See `docs/adr/0068-tradingview-first-icon-sourcing.md`.
 */
export function useAssetIcon(market: Market): UseAssetIconReturn {
  const identity = market.hlCoin ?? market.baseAsset
  const candidates = buildIconCandidateUrls(market)

  const { src, onError } = useIconLadder(identity, candidates)
  const hasError = src === null

  const isDarkFill = DARK_FILL_ICON_COINS.has(market.baseAsset.toUpperCase())

  return { src, hasError, onError, isDarkFill }
}
