// Pure venue-icon source resolution. No React, no IO, no module state. This is
// the single owner of the venue `:network` base-id rule: a runtime venue id may
// carry a network suffix (e.g. `hyperliquid:mainnet`) while the asset map is
// keyed by the bare venue id (`hyperliquid`). Both `VenueIcon` and
// `pnl-card.utils.ts` consume this so the rule lives exactly once.

import { VENUE_ICON_SOURCES } from './venue-icon.constants'

/**
 * Resolve the bundled icon source for a venue id, trying the full id first then
 * the bare prefix before the `:` separator. Returns `null` when no asset is
 * mapped (e.g. the Mock venue), leaving the caller to render a fallback.
 */
export function resolveVenueIconSources(venueId: string): string | null {
  const bareVenueId = venueId.split(':')[0]
  return VENUE_ICON_SOURCES[venueId] ?? VENUE_ICON_SOURCES[bareVenueId] ?? null
}
