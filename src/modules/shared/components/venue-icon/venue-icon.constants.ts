// The single bundled venue→icon asset map for the whole client. Keyed by the
// **bare** venue id (no `:network` suffix). Asset imports live here — a
// constants leaf may import bundled assets, and this is the one place the
// `@/assets/venues/*` marks are imported for the shared `VenueIcon` /
// `resolveVenueIconSources` surface.

import hyperliquidIcon from '@/assets/venues/hyperliquid.png'
import extendedIcon from '@/assets/venues/extended.svg'

export const VENUE_ICON_SOURCES: Readonly<Record<string, string>> = {
  hyperliquid: hyperliquidIcon,
  extended: extendedIcon,
}
