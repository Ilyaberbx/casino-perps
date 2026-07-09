import type { OrderIssue } from '@/modules/shared/domain'
import type { RawSuggestion, StoredSuggestion } from '../../api/suggestions.types'

/** The editable legs of a suggestion before placing (slice 10). Raw strings. */
export interface PreviewEditState {
  readonly marginUsd: string
  readonly leverage: string
  readonly entry: string
  readonly stopLoss: string
  readonly takeProfit: string
}

/** The place lifecycle. */
export type PlaceState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'placing' }
  | { readonly phase: 'error'; readonly message: string }

export interface UseSuggestionPreviewReturn {
  readonly isOpen: boolean
  close(): void
  readonly suggestion: StoredSuggestion | null
  readonly raw: RawSuggestion | null
  readonly readOnly: boolean
  /** A neutral ("no-trade") suggestion: non-executable, legs + Place hidden. */
  readonly isNeutral: boolean
  readonly edit: PreviewEditState
  setMarginUsd(value: string): void
  setLeverage(value: string): void
  setEntry(value: string): void
  setStopLoss(value: string): void
  setTakeProfit(value: string): void
  /** Venue-owned, field-tagged issues re-derived against live state each edit. */
  readonly issues: readonly OrderIssue[]
  readonly place: PlaceState
  readonly canPlace: boolean
  onPlace(): void
}

export interface SuggestionPreviewSheetProps {
  readonly deps?: SuggestionPreviewDeps
}

/** Test seam: omitted in production (capabilities resolve via the venue provider). */
export interface SuggestionPreviewDeps {
  readonly noop?: never
}

export interface RawSuggestionViewProps {
  readonly raw: RawSuggestion
  readonly agentId: string
  /** The suggestion's market (a base asset like `BTC`), for the header icon. */
  readonly symbol: string
}

export interface EditableLegsProps {
  readonly edit: PreviewEditState
  readonly readOnly: boolean
  readonly issues: readonly OrderIssue[]
  setMarginUsd(value: string): void
  setLeverage(value: string): void
  setEntry(value: string): void
  setStopLoss(value: string): void
  setTakeProfit(value: string): void
}
