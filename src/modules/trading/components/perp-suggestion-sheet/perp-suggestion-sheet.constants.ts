import type { Market } from '@/modules/shared/domain'
import type {
  SheetTab,
  SuggestStepId,
  SuggestStepStatus,
  SuggestionToken,
} from './perp-suggestion-sheet.types'
import type { AgentId } from './ai-agents.types'

export const SUGGESTION_SHEET_ARIA_LABEL = 'AI suggestion sheet'

/**
 * Stable empty token projection substituted while the combobox is collapsed
 * (OPT-1). The dropdown's filter + grouping only feed the open dropdown, so a
 * closed combobox returns this frozen, referentially-stable array instead of
 * rebuilding the filtered list on every `tokens` / query change. Frozen so the
 * shared identity can never be mutated.
 */
export const EMPTY_TOKENS: readonly SuggestionToken[] = Object.freeze([])

/**
 * Stable empty venue-market projection returned by the sheet hook's market store
 * when no `marketData` capability is mounted. Frozen + referentially-stable so
 * `useSyncExternalStore`'s `getSnapshot` never returns a fresh array (which would
 * loop the store), mirroring `EMPTY_TOKENS`.
 */
export const EMPTY_MARKETS: readonly Market[] = Object.freeze([])

export const DEFAULT_TAB: SheetTab = 'suggest'
export const DEFAULT_AGENT_ID: AgentId = 'minara'

export const SHEET_TITLE = 'AI Suggestion'

/**
 * The six ordered Suggest steps (slice 09). A legitimate ordered sequence — the
 * carve-out the "no 01/02/03 scaffolding" ban allows — rendered as a quiet step
 * indicator, not loud numbered eyebrows. Labels stay mono (data/label face).
 */
export const SUGGEST_STEPS: ReadonlyArray<{
  readonly id: SuggestStepId
  readonly label: string
}> = [
  { id: 'dex', label: 'DEX' },
  { id: 'token', label: 'Token' },
  { id: 'params', label: 'Params' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'execute', label: 'Execute' },
  { id: 'preview', label: 'Preview' },
] as const

/** The accessible label for the stepper region (slice 09). */
export const STEPPER_ARIA_LABEL = 'Suggestion progress'

/** Title of the stepper's hover hint — the breakdown of where the ask is in the
 *  DEX → Preview path. */
export const STEPPER_HINT_TITLE = 'Suggestion steps'

/** Per-status glyph + word for each step row in the stepper hover hint. */
export const STEP_STATUS_MARK: Record<SuggestStepStatus, string> = {
  complete: '✓',
  current: '▸',
  upcoming: '·',
}
export const STEP_STATUS_WORD: Record<SuggestStepStatus, string> = {
  complete: 'done',
  current: 'now',
  upcoming: 'next',
}
export const SHEET_LEAD =
  'Pick an agent, configure your ask, estimate the cost, then execute. Side is the agent’s output — you only shape the request.'

/** Suffix for the disabled, not-yet-live dropdown options (Extended DEX, Native
 *  Agent) — renders e.g. "Extended · coming soon". */
export const SOON_BADGE = 'coming soon'

export const USE_CURRENT_MARKET_LABEL = 'Use current market'

export const TOKEN_SEARCH_PLACEHOLDER = 'Search markets'

/**
 * Estimated heights (px) for the virtualizer's `estimateSize` over the flat
 * `displayRows` list (OPT-2, ADR-0019). Token rows are the icon + symbol button;
 * headers are the shorter asset-class section label. Mirrors the rendered CSS so
 * the first (pre-measurement) frame sizes the scroll container close to reality.
 */
export const TOKEN_ROW_HEIGHT_PX = 37
export const TOKEN_GROUP_HEADER_HEIGHT_PX = 22

/**
 * Max rows the pre-measurement fallback renders before the virtualizer's
 * ResizeObserver reports a real window. Bounds the single pre-measurement frame
 * (and jsdom, which never measures `clientHeight`) so a real-browser open never
 * paints the full ~247-symbol catalog un-virtualized. Mirrors MarketList's
 * FALLBACK_ROW_CAP (OPT-2, ADR-0019).
 */
export const TOKEN_LIST_FALLBACK_ROW_CAP = 40
export const TOKEN_LIST_EMPTY_COPY = 'No markets match your search.'
/** Shimmer rows shown in the open dropdown while the token list loads (slice 12). */
export const TOKEN_LIST_SKELETON_ROWS = 6

export const ESTIMATE_LABEL = 'Estimate cost'
export const EXECUTE_LABEL = 'Execute suggestion'
export const RE_ESTIMATE_LABEL = 'Re-estimate'
export const GRANT_ACCESS_LABEL = 'Grant signingless access'
/** Disabled Execute beat shown while the per-agent delegation status resolves (slice 12). */
export const CHECKING_ACCESS_LABEL = 'Checking access…'
export const TOP_UP_LABEL = 'Top up Agent Balance'

/** The persistent Agent Balance footer label (slice 08). */
export const AGENT_BALANCE_LABEL = 'Agent Balance'

/**
 * The estimate freshness grace period (slice 07). An estimate older than this is
 * stale: execute is blocked and the action button forces an explicit, free
 * re-estimate. Distinct from the server's 5-min executed-suggestion TTL — this
 * gate is purely client-side and scoped to the (unpaid) quote.
 */
export const ESTIMATE_GRACE_PERIOD_MS = 10_000

/** The stale-estimate hint shown alongside the Re-estimate button (slice 07). */
export const STALE_ESTIMATE_COPY =
  'This quote is stale. Re-estimate before executing.'

export const HISTORY_EMPTY_COPY = 'No suggestions yet — ask an agent.'
/** Shimmer rows shown while the suggestion history loads (slice 12). */
export const HISTORY_SKELETON_ROWS = 4
export const EXPIRED_BADGE = 'expired'
export const REOPEN_LABEL = 'Open'

export const AGENT_WORKING_COPY = 'is computing your suggestion'

/** The async-pending working copy (ADR-0073): the durable job is in flight; the
 *  user can close the sheet and be toasted on resolution. */
export const SUGGESTION_PENDING_TITLE = 'Generating your suggestion'
export const SUGGESTION_PENDING_COPY =
  'This can take up to ~90s. You can close this — we’ll notify you when it’s ready.'
