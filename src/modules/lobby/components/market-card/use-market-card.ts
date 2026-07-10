import { useState } from 'react'
import { symbolGradient } from '../../utils/symbol-gradient'
import { displayTicker, symbolInitials } from '../../utils/symbol-ticker'
import { symbolLogoUrl } from '../../utils/symbol-logo-url'
import { formatChangePct } from '../../utils/format-change-pct'
import type { MarketCardProps, UseMarketCardResult } from './market-card.types'

/**
 * Smart hook for the poster card — owns the only piece of state (logo load
 * failure) and all derived presentation values, so `MarketCard` stays a pure
 * render. The effective logo URL prefers the caller-supplied `logoUrl`, else the
 * shared-plumbing lookup from the symbol; a load error clears it so the dumb
 * component swaps to the initials placeholder.
 */
export function useMarketCard({
  symbol,
  changePct,
  logoUrl,
}: MarketCardProps): UseMarketCardResult {
  const [hasLogoError, setHasLogoError] = useState(false)

  const resolvedLogoUrl = logoUrl ?? symbolLogoUrl(symbol)
  const hasUsableLogo = resolvedLogoUrl !== null && !hasLogoError
  const logoSrc = hasUsableLogo ? resolvedLogoUrl : null

  const isUp = changePct >= 0

  return {
    gradient: symbolGradient(symbol),
    logoSrc,
    initials: symbolInitials(symbol),
    ticker: displayTicker(symbol),
    isUp,
    changeLabel: formatChangePct(changePct),
    onLogoError: () => setHasLogoError(true),
  }
}
