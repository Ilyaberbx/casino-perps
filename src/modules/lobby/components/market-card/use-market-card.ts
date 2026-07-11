import { useIconLadder } from '@/modules/shared/hooks/use-icon-ladder'
import { symbolGradient } from '../../utils/symbol-gradient'
import { displayTicker, symbolInitials } from '../../utils/symbol-ticker'
import { symbolLogoCandidates } from '../../utils/symbol-logo-url'
import { formatChangePct } from '../../utils/format-change-pct'
import type { MarketCardProps, UseMarketCardResult } from './market-card.types'

/**
 * Smart hook for the poster card — owns the icon-ladder state and all derived
 * presentation values, so `MarketCard` stays a pure render. The candidate list
 * prefers the caller-supplied `logoUrl`, then walks the full shared icon ladder
 * (HL CDN → TradingView → spot bare) via `useIconLadder`; exhausting it swaps
 * the dumb component to the initials placeholder.
 */
export function useMarketCard({
  symbol,
  changePct,
  logoUrl,
}: MarketCardProps): UseMarketCardResult {
  const ladder = symbolLogoCandidates(symbol)
  const candidates = logoUrl ? [logoUrl, ...ladder.filter((url) => url !== logoUrl)] : ladder

  const { src: logoSrc, onError: onLogoError } = useIconLadder(symbol, candidates)

  const isUp = changePct >= 0

  return {
    gradient: symbolGradient(symbol),
    logoSrc,
    initials: symbolInitials(symbol),
    ticker: displayTicker(symbol),
    isUp,
    changeLabel: formatChangePct(changePct),
    onLogoError,
  }
}
