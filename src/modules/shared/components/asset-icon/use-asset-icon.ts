import { useState } from 'react'
import type { Market } from '@/modules/shared/domain/domain.types'
import {
  resolveTvIconUrl,
  resolveHlFallbackUrl,
  resolveSpotBareIconUrl,
  isCryptoMarket,
} from '@/modules/shared/utils/resolve-market-icon-url'
import { DARK_FILL_ICON_COINS } from '@/modules/shared/constants/tradingview-icon-map.constants'
import type { UseAssetIconReturn } from './asset-icon.types'

interface AttemptState {
  identity: string
  failedCount: number
}

const INITIAL_ATTEMPT: AttemptState = { identity: '', failedCount: 0 }

/**
 * The ordered icon URLs to try for a market, best source first — class-aware.
 * The `<img>` walks this list: each `onError` advances one rung; running off the
 * end renders the letter placeholder.
 *
 * - **crypto (perp/spot)**: Hyperliquid CDN first (coin-correct), then the
 *   TradingView logoid as a fallback, then the spot bare `{BASE}.svg`.
 * - **HIP-3**: TradingView logoid first (HL has no equity/commodity icon).
 *
 * Crypto leads with HL because TV's `crypto/XTVC{SYM}` namespace collides across
 * same-ticker projects and would otherwise load a wrong-but-valid icon (it never
 * errors, so the ladder never advances to the correct HL icon). Duplicates are
 * dropped. See `docs/adr/0068-tradingview-first-icon-sourcing.md` (amended).
 */
function buildIconCandidates(market: Market): string[] {
  const tvUrl = resolveTvIconUrl(market)
  const hlFallbackUrl = resolveHlFallbackUrl(market)
  const spotBareUrl = resolveSpotBareIconUrl(market)

  const ordered = isCryptoMarket(market)
    ? [hlFallbackUrl, tvUrl, spotBareUrl]
    : [tvUrl, hlFallbackUrl, spotBareUrl]

  const present = ordered.filter((url): url is string => url !== null)
  return present.filter((url, index) => present.indexOf(url) === index)
}

/**
 * Smart hook for AssetIcon — owns all state, derived values, and handlers.
 *
 * The fallback ladder is a flat ordered candidate list (see
 * `buildIconCandidates`); `attempt.failedCount` is how many candidates have
 * errored. `attempt.identity` is the market identity the count tracks against,
 * so changing markets resets the ladder without a setState-in-effect.
 *
 * See `docs/adr/0068-tradingview-first-icon-sourcing.md`.
 */
export function useAssetIcon(market: Market): UseAssetIconReturn {
  const identity = market.hlCoin ?? market.baseAsset
  const candidates = buildIconCandidates(market)

  const [attempt, setAttempt] = useState<AttemptState>(INITIAL_ATTEMPT)
  const isAttemptForCurrentMarket = attempt.identity === identity
  const failedCount = isAttemptForCurrentMarket ? attempt.failedCount : 0

  const src = candidates[failedCount] ?? null
  const hasError = src === null

  const isDarkFill = DARK_FILL_ICON_COINS.has(market.baseAsset.toUpperCase())

  const onError = () => {
    setAttempt({ identity, failedCount: failedCount + 1 })
  }

  return { src, hasError, onError, isDarkFill }
}
