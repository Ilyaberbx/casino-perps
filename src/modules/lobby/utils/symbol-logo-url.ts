import {
  buildIconMarketFromSymbol,
  resolveMarketIconUrl,
} from '@/modules/shared/utils/resolve-market-icon-url'

/**
 * The primary token-logo URL for a raw venue symbol, or `null` when none is
 * mapped (the card then falls back to the display-face initials).
 *
 * Reuses the shared icon plumbing — `buildIconMarketFromSymbol` +
 * `resolveMarketIconUrl` — rather than inventing a new CDN fetcher, so poster
 * cards resolve the same logo the market rows do. Only the primary rung of the
 * ladder is used here; a poster card that fails to load its logo shows the
 * initials placeholder instead of walking further fallbacks.
 */
export function symbolLogoUrl(symbol: string): string | null {
  const resolution = resolveMarketIconUrl(buildIconMarketFromSymbol(symbol))
  if (resolution.kind === 'placeholder') return null
  return resolution.url
}
