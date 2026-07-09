import type { SuggestionVenueId } from '../../api/suggestions.types'
import type { DexOption } from './perp-suggestion-sheet.types'

/**
 * The sheet's DEX (venue) options, in display order (slice 04). Hyperliquid is
 * live and the default; Extended is roadmap-only — rendered disabled with a
 * "soon" badge, mirroring the Native Agent treatment in `ai-agents.constants.ts`.
 * The ids use the `SuggestionVenueId` vocabulary from the slice-03 server union.
 */
export const HYPERLIQUID_DEX: DexOption = {
  id: 'hyperliquid',
  label: 'Hyperliquid',
  comingSoon: false,
}

export const EXTENDED_DEX: DexOption = {
  id: 'extended',
  label: 'Extended',
  comingSoon: true,
}

/** Every DEX shown in the selector, in display order. */
export const DEX_OPTIONS: readonly DexOption[] = [HYPERLIQUID_DEX, EXTENDED_DEX]

/** The sheet-owned default DEX (slice 04) — Hyperliquid, the only live venue. */
export const DEFAULT_VENUE_ID: SuggestionVenueId = 'hyperliquid'
