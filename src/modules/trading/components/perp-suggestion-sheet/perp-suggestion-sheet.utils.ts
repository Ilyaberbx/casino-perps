import { StatusCodes } from 'http-status-codes'
import type { ApiError, HttpError } from '@/modules/shared/http'
import { apiErrorCode, apiErrorIssues, apiErrorMessage } from '@/modules/shared/utils/api-error-copy'
import type { Market } from '@/modules/shared/domain'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { buildIconMarket } from '@/modules/shared/utils/resolve-market-icon-url'
import { matchesSymbolOrBaseAsset } from '@/modules/shared/utils/match-by-symbol-or-base-asset'
import { MARKET_CATEGORY_TABS } from '../../trading.constants'
import { filterByMinVolume, getMarketCategory } from '../../trading.utils'
import type { MarketCategory } from '../../trading.types'
import type { SuggestionParams } from '../../api/suggestions.types'
import { MINARA_CATALOG_SYMBOLS } from './minara-catalog.constants'
import { SUGGEST_STEPS } from './perp-suggestion-sheet.constants'
import type {
  ParamFormValues,
  ParamIssue,
  SuggestStep,
  SuggestStepId,
  SuggestionFailure,
  SuggestionListRow,
  SuggestionToken,
  SuggestionTokenGroup,
} from './perp-suggestion-sheet.types'
import { AI_AGENTS } from './ai-agents.constants'
import type { AgentIconKind } from './ai-agents.types'

/**
 * The bundled icon kind for a suggestion's `agentId` (ADR-0048). Looks the id up
 * in the declared agent registry; falls back to the neutral three-eye motif for
 * an unknown / legacy provider so a history row always renders an icon.
 */
export function resolveAgentIconKind(agentId: string): AgentIconKind {
  const agent = AI_AGENTS.find((a) => a.id === agentId)
  return agent?.iconKind ?? 'three-eye'
}

/**
 * Resolve a market from the venue list by the AI suggestion's symbol (ADR-0056).
 * The suggestion symbol is a base asset (`BTC`, `SOL`); match the perp market by
 * `baseAsset`, case-insensitively. `null` when no market carries that base asset.
 */
export function marketForSuggestionSymbol(
  markets: readonly Market[],
  symbol: string,
): Market | null {
  const target = symbol.trim().toUpperCase()
  if (target.length === 0) return null
  const isPerp = (m: Market): boolean => m.marketType !== 'spot'
  const match = markets.find(
    (m) => isPerp(m) && m.baseAsset.toUpperCase() === target,
  )
  return match ?? null
}

/** The max leverage of the market carrying `symbol`'s base asset, or undefined. */
export function maxLeverageForSymbol(
  markets: readonly Market[],
  symbol: string,
): number | undefined {
  return marketForSuggestionSymbol(markets, symbol)?.maxLeverage
}

/**
 * The base asset for the terminal's selected market (ADR-0056) — the value the
 * opt-in "use current market" prefill seeds into the sheet. Resolves against the
 * venue market list (so `BTC-PERP` → `BTC`); falls back to the raw symbol when
 * the market is not found.
 */
export function baseSymbolOfMarket(
  markets: readonly Market[],
  selectedMarket: string,
): string {
  const match = markets.find((m) => m.symbol === selectedMarket)
  return match ? match.baseAsset.toUpperCase() : selectedMarket
}

/**
 * Build the offerable token list from Minara's full catalog (ADR-0062), gated by
 * the server allowlist so the client never offers a symbol the server would 422
 * on. Each token carries its asset-class `category` (for the grouped dropdown).
 * Ordered by the catalog (Minara's order); de-duplicated, case-insensitive.
 */
export function buildMinaraCatalogTokens(
  allowedSymbols: readonly string[],
): SuggestionToken[] {
  const allowed = new Set(allowedSymbols.map((s) => s.trim().toUpperCase()))
  const tokens: SuggestionToken[] = []
  const seen = new Set<string>()
  for (const raw of MINARA_CATALOG_SYMBOLS) {
    const symbol = raw.trim().toUpperCase()
    const isOfferable = allowed.has(symbol) && !seen.has(symbol)
    if (!isOfferable) continue
    seen.add(symbol)
    tokens.push({
      // Icon-only synthetic Market (ADR-0062): the AI token list is decoupled
      // from the connected venue, so it carries just enough for `AssetIcon`.
      symbol,
      market: buildIconMarket(symbol, 'perp'),
      category: getMarketCategory(symbol),
    })
  }
  return tokens
}

/**
 * Gate the suggestion token list against the venue's liquid market set so it can
 * never offer a *venue market* the Market Selection window hides as illiquid —
 * the single-source-of-truth fix (ADR-0064, amending ADR-0062). A token is kept
 * when the venue does NOT list its base asset (the non-crypto Minara catalog is a
 * deliberate AI-only superset — stocks, commodities, etc. have no venue path) OR
 * the venue lists it AND it clears the SAME `minVolumeUsd` floor the window uses.
 *
 * Stability (preserves ADR-0062): with no venue list — not yet loaded, a venue
 * switch, or a `listMarkets()` failure — the list is NOT narrowed; the full
 * catalog superset is returned so the sheet never silently shrinks. Pure — no
 * React, no I/O, no module state.
 */
export function filterTokensByVenueLiquidity(
  tokens: readonly SuggestionToken[],
  venueMarkets: readonly Market[],
  minVolumeUsd: number,
): SuggestionToken[] {
  const hasVenueList = venueMarkets.length > 0
  if (!hasVenueList) return [...tokens]

  const isPerp = (m: Market): boolean => m.marketType !== 'spot'
  const perpMarkets = venueMarkets.filter(isPerp)
  const listedBaseAssets = new Set(perpMarkets.map((m) => m.baseAsset.toUpperCase()))
  const liquidBaseAssets = new Set(
    filterByMinVolume([...perpMarkets], minVolumeUsd).map((m) => m.baseAsset.toUpperCase()),
  )

  return tokens.filter((token) => {
    const baseAsset = token.symbol.toUpperCase()
    const isVenueListed = listedBaseAssets.has(baseAsset)
    const isLiquidVenueMarket = liquidBaseAssets.has(baseAsset)
    return !isVenueListed || isLiquidVenueMarket
  })
}

/**
 * Group tokens by asset class into ordered, non-empty sections for the Market
 * dropdown (ADR-0062). Section order + labels follow `MARKET_CATEGORY_TABS`
 * (Minara's tab order), skipping the `'all'` tab. Token order within a section is
 * preserved (catalog order). Pure — no React, no I/O, no module state.
 */
export function groupTokensByCategory(
  tokens: readonly SuggestionToken[],
): SuggestionTokenGroup[] {
  const byCategory = new Map<MarketCategory, SuggestionToken[]>()
  for (const token of tokens) {
    const bucket = byCategory.get(token.category)
    if (bucket) bucket.push(token)
    else byCategory.set(token.category, [token])
  }

  const groups: SuggestionTokenGroup[] = []
  for (const tab of MARKET_CATEGORY_TABS) {
    if (tab.value === 'all') continue
    const categoryTokens = byCategory.get(tab.value)
    const hasTokens = categoryTokens !== undefined && categoryTokens.length > 0
    if (!hasTokens) continue
    groups.push({ category: tab.value, label: tab.label, tokens: categoryTokens })
  }
  return groups
}

/**
 * Flatten the grouped sections into a single discriminated row list (OPT-2,
 * ADR-0019): each group becomes a `header` row followed by its `token` rows, in
 * group order. One flat list lets a single virtualizer window headers + tokens
 * together. Pure — no React, no I/O, no module state.
 */
export function flattenTokenGroups(
  groups: readonly SuggestionTokenGroup[],
): SuggestionListRow[] {
  const rows: SuggestionListRow[] = []
  for (const group of groups) {
    rows.push({ kind: 'header', category: group.category, label: group.label })
    for (const token of group.tokens) {
      rows.push({ kind: 'token', token })
    }
  }
  return rows
}

/**
 * Filter tokens by a case-insensitive substring search over the display symbol
 * and the market's base asset, via the shared `matchesSymbolOrBaseAsset` predicate
 * (the same one Market Selection's `filterBySearch` uses).
 * Empty query returns the list unchanged.
 */
export function filterTokensBySearch(
  tokens: readonly SuggestionToken[],
  query: string,
): SuggestionToken[] {
  const trimmed = query.trim().toLowerCase()
  const isEmptyQuery = trimmed.length === 0
  if (isEmptyQuery) return [...tokens]
  return tokens.filter((token) =>
    matchesSymbolOrBaseAsset({ symbol: token.symbol, baseAsset: token.market.baseAsset }, trimmed),
  )
}

/** The field-tagged message for a param key, or null when that field is clean. */
export function paramIssueFor(
  issues: readonly ParamIssue[],
  key: string,
): string | null {
  const issue = issues.find((i) => i.field === key)
  return issue ? issue.message : null
}

/** Parse a raw numeric input to a number, or `undefined` when blank / invalid. */
function parseNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Client (UX) validation as the trader edits (ADR-0048 D-1, slice 08): margin ≤
 * live collateral, leverage ≤ `min(market, 40)`. Field-tagged issues mirror the
 * order ticket's `OrderIssue` shape. The server re-validates authoritatively.
 */
export function validateParams(
  values: ParamFormValues,
  marginMax: number,
  leverageMax: number,
): ParamIssue[] {
  const issues: ParamIssue[] = []

  const hasSymbol = values.symbol.trim().length > 0
  if (!hasSymbol) issues.push({ field: 'symbol', message: 'Select a market' })

  const margin = parseNumber(values.marginUsd)
  const isMarginPositive = margin !== undefined && margin > 0
  if (!isMarginPositive) {
    issues.push({ field: 'marginUsd', message: 'Enter a margin amount' })
  }
  const isMarginOverCap = margin !== undefined && margin > marginMax
  if (isMarginOverCap) {
    issues.push({
      field: 'marginUsd',
      message: `Margin exceeds available collateral (${formatUsd(marginMax)})`,
    })
  }

  const leverage = parseNumber(values.leverage)
  const isLeveragePositive = leverage !== undefined && leverage >= 1
  if (!isLeveragePositive) {
    issues.push({ field: 'leverage', message: 'Enter leverage of at least 1x' })
  }
  const isLeverageOverCap = leverage !== undefined && leverage > leverageMax
  if (isLeverageOverCap) {
    issues.push({
      field: 'leverage',
      message: `Leverage exceeds the cap (${leverageMax}x)`,
    })
  }

  return issues
}

/** Project the raw form values into the typed request params sent to the server. */
export function toSuggestionParams(values: ParamFormValues): SuggestionParams {
  return {
    symbol: values.symbol,
    style: values.style,
    marginUsd: parseNumber(values.marginUsd),
    leverage: parseNumber(values.leverage),
  }
}

/** Whether a stored suggestion is past its validity window (read-only). */
export function isExpired(expiresAtIso: string, now: number = Date.now()): boolean {
  const expiresAt = new Date(expiresAtIso).getTime()
  return !Number.isFinite(expiresAt) || expiresAt <= now
}

const MS_PER_SECOND = 1_000
const SECONDS_PER_MINUTE = 60

/**
 * A short, live "updated Ns ago" marker (slice 07) for the estimate freshness
 * signal. Pure — `now` and `producedAt` are epoch ms passed in (the hook owns the
 * 1s tick), so it never reads the clock. Under a second reads "just now"; under a
 * minute counts seconds; otherwise counts whole minutes. A `producedAt` in the
 * future (clock skew) clamps to "just now" rather than printing a negative age.
 */
export function formatUpdatedAgo(producedAt: number, now: number): string {
  const elapsedMs = now - producedAt
  const isJustNow = elapsedMs < MS_PER_SECOND
  if (isJustNow) return 'updated just now'

  const totalSeconds = Math.floor(elapsedMs / MS_PER_SECOND)
  const isUnderAMinute = totalSeconds < SECONDS_PER_MINUTE
  if (isUnderAMinute) return `updated ${totalSeconds}s ago`

  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  return `updated ${minutes}m ago`
}

/**
 * Whether a ready estimate has aged past the grace period (slice 07). Pure —
 * `now` / `producedAt` are epoch ms and `gracePeriodMs` is injected, so the gate
 * is deterministic in tests. An age exactly equal to the grace period is still
 * fresh; only a strictly older quote is stale.
 */
export function isEstimateStale(
  producedAt: number,
  now: number,
  gracePeriodMs: number,
): boolean {
  return now - producedAt > gracePeriodMs
}

/**
 * Map a server failure to a specific, actionable failure (slice 06). Shared by
 * the estimate and execute paths so both surface the same reason. Each transport
 * error class reads as its own headline + next step; an API error defers to
 * `mapApiError`, which preserves every 422 issue and the retryable distinction.
 */
export function mapSuggestionError(error: HttpError): SuggestionFailure {
  if (error.kind === 'session-expired') {
    return {
      title: 'Session expired',
      detail: 'Reconnect your wallet and try again.',
      details: [],
      retryable: false,
    }
  }
  if (error.kind === 'network') {
    return {
      title: 'Network error',
      detail: 'Could not reach the server. Check your connection and retry.',
      details: [],
      retryable: true,
    }
  }
  if (error.kind === 'parse') {
    return {
      title: 'Unexpected response',
      detail: 'The agent returned something we could not read. Try again.',
      details: [],
      retryable: true,
    }
  }
  return mapApiError(error)
}

/** Back-compat name (slice 06): the execute path still calls `mapExecuteError`. */
export const mapExecuteError = mapSuggestionError

function mapApiError(error: ApiError): SuggestionFailure {
  const code = apiErrorCode(error)
  const isInsufficientBalance =
    error.status === StatusCodes.PAYMENT_REQUIRED || code === 'INSUFFICIENT_AGENT_BALANCE'
  if (isInsufficientBalance) {
    return {
      title: 'Insufficient Agent Balance',
      detail: 'Top up your Agent Balance to cover the call price.',
      details: [],
      retryable: false,
    }
  }
  if (code === 'UNKNOWN_AGENT') {
    return {
      title: 'Agent unavailable',
      detail: 'That agent is not available. Pick another.',
      details: [],
      retryable: false,
    }
  }
  if (code === 'DELEGATION_NOT_ACTIVE') {
    return {
      title: 'Signingless access expired',
      detail: 'Grant signingless access again before executing.',
      details: [],
      retryable: false,
    }
  }
  const isInputInvalid =
    error.status === StatusCodes.UNPROCESSABLE_ENTITY || code === 'SUGGESTION_INPUT_INVALID'
  if (isInputInvalid) return mapInputInvalid(error)
  return {
    title: 'Agent unavailable',
    detail: 'The agent could not complete the call. Try again shortly.',
    details: [],
    retryable: true,
  }
}

/**
 * Map a 422 `SUGGESTION_INPUT_INVALID` body to a fixable (non-retryable) failure
 * that surfaces *every* server issue line — not just the first, and never the
 * old generic "Adjust your inputs and try again." Each line already names the
 * offending value. The lead `detail` is the server's summary `message` (the most
 * actionable issue, balance-first) when present, else the first issue line.
 */
function mapInputInvalid(error: ApiError): SuggestionFailure {
  const lines = Object.values(apiErrorIssues(error) ?? {})
  const summary = apiErrorMessage(error)
  const FALLBACK_DETAIL = 'Adjust your inputs and try again.'
  const detail = summary ?? lines[0] ?? FALLBACK_DETAIL
  return {
    title: 'Invalid request',
    detail,
    details: lines,
    retryable: false,
  }
}

/** The flow facts the stepper derivation reads (slice 09). A flat snapshot of the
 *  Suggest flow's progress — kept narrow so the derivation is a pure function the
 *  hook calls, not a re-derivation of hook state. */
export interface SuggestFlowState {
  /** A token is chosen (the param form's symbol is non-empty). */
  readonly hasToken: boolean
  /** The full request is valid (symbol + margin + leverage + style). */
  readonly paramsValid: boolean
  /** A fresh, ready estimate exists (ready and not aged past the grace period). */
  readonly hasFreshEstimate: boolean
  /** Execute is unblocked right now (connected + delegation + sufficient + fresh). */
  readonly canExecute: boolean
  /** The execute call is in flight (the agent-working beat is showing). */
  readonly isExecuting: boolean
}

/**
 * Derive the six ordered Suggest steps with their progress state (slice 09). DEX
 * is the always-satisfied entry (a venue is selected by default), so the flow's
 * progress is driven by token → params → estimate → execute. The **current** step
 * is the first not-yet-complete step; every step before it is `complete`, every
 * step after it `upcoming`. The teal accent lands on `current` only. Preview is
 * the terminal step — it is `current` while the execute call runs (the preview is
 * about to open) and otherwise `upcoming` until the flow reaches it.
 */
export function deriveSuggestSteps(flow: SuggestFlowState): readonly SuggestStep[] {
  const completeById: Record<SuggestStepId, boolean> = {
    dex: true,
    token: flow.hasToken,
    params: flow.hasToken && flow.paramsValid,
    estimate: flow.hasFreshEstimate,
    execute: flow.hasFreshEstimate && flow.canExecute && flow.isExecuting,
    preview: false,
  }

  const firstIncompleteIndex = SUGGEST_STEPS.findIndex(
    (step) => !completeById[step.id],
  )

  return SUGGEST_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: stepStatus(completeById[step.id], index, firstIncompleteIndex),
  }))
}

/** Project a step's completion + position into a status (slice 09). */
function stepStatus(
  isComplete: boolean,
  index: number,
  firstIncompleteIndex: number,
): SuggestStep['status'] {
  if (isComplete) return 'complete'
  const isCurrent = index === firstIncompleteIndex
  if (isCurrent) return 'current'
  return 'upcoming'
}
