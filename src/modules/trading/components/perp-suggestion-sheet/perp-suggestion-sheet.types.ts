import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import type {
  AgentBalanceViewModel,
  DelegationStatusView,
} from '@/modules/agent-balance'
import type { Market } from '@/modules/shared/domain'
import type { MarketCategory } from '../../trading.types'
import type { EstimateSuggestion } from '../../api/estimate-suggestion'
import type { ExecuteSuggestion } from '../../api/execute-suggestion'
import type { GetSuggestionHistory } from '../../api/get-suggestion-history'
import type { GetSuggestionMarkets } from '../../api/get-suggestion-markets'
import type { SuggestionSymbolStore } from '../../services/suggestion-symbol-store'
import type {
  EstimateResult,
  StoredSuggestion,
  SuggestionParams,
  SuggestionStyle,
  SuggestionVenueId,
} from '../../api/suggestions.types'
import type {
  AgentDescriptor,
  AgentFieldSchema,
  AgentIconKind,
  AgentId,
} from './ai-agents.types'

/** The two AI Sheet tabs (ADR-0048). */
export type SheetTab = 'suggest' | 'history'

/**
 * The six ordered steps of the Suggest flow (slice 09). A real ordered sequence
 * (the only kind the "no 01/02/03 scaffolding" ban exempts): pick a DEX, pick a
 * token, shape the params, estimate the cost, execute, then review the preview.
 */
export type SuggestStepId =
  | 'dex'
  | 'token'
  | 'params'
  | 'estimate'
  | 'execute'
  | 'preview'

/**
 * A step's progress state (slice 09). `complete` = the step's precondition is
 * satisfied; `current` = the first not-yet-complete step (where the user is now);
 * `upcoming` = not reached yet. The teal accent lands on `current` only.
 */
export type SuggestStepStatus = 'complete' | 'current' | 'upcoming'

/** One rendered step in the quiet stepper (slice 09). Dumb data — no behaviour. */
export interface SuggestStep {
  readonly id: SuggestStepId
  readonly label: string
  readonly status: SuggestStepStatus
}

/** The stepper component's props (slice 09). Dumb — fed by the sheet hook. */
export interface SuggestStepperProps {
  readonly steps: readonly SuggestStep[]
}

/** The stepper hover-hint hook's return: open state + the anchor/panel refs the
 *  `Popover` positions, plus open/close handlers (hover + keyboard focus). */
export interface UseSuggestStepperReturn {
  readonly isHintOpen: boolean
  readonly triggerRef: RefObject<HTMLDivElement | null>
  readonly hintRef: RefObject<HTMLDivElement | null>
  open(): void
  close(): void
}

/** The hover-hint panel's props: the steps to break down + the `Popover` panel
 *  ref it attaches to its root for positioning. Dumb. */
export interface SuggestStepperHintProps {
  readonly steps: readonly SuggestStep[]
  readonly panelRef: RefObject<HTMLDivElement | null>
}

/**
 * Typed CSS custom property the dumb stepper writes for the runtime fill width
 * of the pixel progress bar. Mirrors `PixelSliderStyle` — runtime-dependent
 * style lives in a `*.styles.ts`, never the CSS module.
 */
export interface SuggestProgressStyle extends CSSProperties {
  '--suggest-progress-fill': string
}

/**
 * A selectable DEX in the sheet's DEX step (slice 04). `comingSoon: true` marks
 * the disabled, not-yet-live option (Extended), mirroring the Native Agent idiom.
 */
export interface DexOption {
  readonly id: SuggestionVenueId
  readonly label: string
  readonly comingSoon: boolean
}

/** A param field the validator can tag an issue against. */
export type ParamFieldKey = 'symbol' | 'marginUsd' | 'leverage' | 'style'

/** The editable param form values (raw strings for the numeric sliders). */
export interface ParamFormValues {
  readonly symbol: string
  readonly marginUsd: string
  readonly leverage: string
  readonly style: SuggestionStyle
}

/** A field-tagged validation issue, mirroring the order ticket's `OrderIssue`. */
export interface ParamIssue {
  readonly field?: ParamFieldKey
  readonly message: string
}

/**
 * One offerable token in the sheet's Market step: the display symbol (a base
 * asset like `BTC`), a synthetic `Market` used to resolve its icon, and the
 * asset-class `category` used to group the dropdown. The list is Minara's full
 * catalog (decoupled from the connected venue — ADR-0062) gated by the server
 * allowlist, so the client never offers a symbol the server would 422 on.
 */
export interface SuggestionToken {
  readonly symbol: string
  readonly market: Market
  readonly category: MarketCategory
}

/** The param-form sub-hook's view-model (slice 08). */
export interface AgentParamFormViewModel {
  readonly values: ParamFormValues
  readonly issues: readonly ParamIssue[]
  /**
   * Which fields the trader has interacted with (keyed by `ParamFieldKey`). The
   * slider field shows its inline issue only once its key is touched, so a
   * pristine $0 margin stays silent on open. `isValid` is NOT gated on this.
   */
  readonly touched: Record<string, boolean>
  readonly allowedSymbols: readonly string[]
  /**
   * The offerable, icon-backed token list (slice 05): the intersection of the
   * venue's perp markets and the server allowlist. The Market field renders this.
   */
  readonly tokens: readonly SuggestionToken[]
  /**
   * Whether the token list is still loading (slice 12) — the Market field shows a
   * skeleton instead of the catalog superset while true, so the picker never
   * visibly narrows when the venue list lands.
   */
  readonly tokensLoading: boolean
  readonly marginMax: number
  readonly leverageMax: number
  readonly isValid: boolean
  setSymbol(symbol: string): void
  setMarginUsd(marginUsd: string): void
  setLeverage(leverage: string): void
  setStyle(style: SuggestionStyle): void
  toParams(): SuggestionParams
}

export interface UseAgentParamFormOptions {
  /**
   * The sheet-owned default symbol (ADR-0056) — resolved by the orchestrator
   * from the last-used-symbol store, NOT from the Trade Page's selected market.
   */
  readonly defaultSymbol: string
  /**
   * The icon-backed token list (slice 05) the Market field offers — the
   * intersection of the venue's perp markets and the server allowlist, resolved
   * by the orchestrator. Empty until the venue markets + allowlist have loaded.
   */
  readonly tokens: readonly SuggestionToken[]
  /**
   * Whether the offered token list is still loading (slice 12) — the allowlist
   * fetch is in flight or the venue market list hasn't arrived. The Market field
   * shows a skeleton instead of the full-catalog superset while this is true.
   */
  readonly tokensLoading: boolean
  /** Live perp collateral (the margin slider cap), or `null` when unavailable. */
  readonly availableCollateralUsd: number | null
  /**
   * Resolves the max leverage for the SHEET'S OWN selected symbol (ADR-0056) —
   * not the terminal market. `undefined` when the market is unknown; the cap
   * then falls back to the agent max.
   */
  readonly resolveMarketMaxLeverage: (symbol: string) => number | undefined
  /**
   * Notified whenever the symbol changes (via `setSymbol`), so the orchestrator
   * can persist the last-used symbol. Side-effect-free here.
   */
  readonly onSymbolChange?: (symbol: string) => void
}

/** The estimate-step lifecycle (slice 09). Estimate failures carry the same
 *  mapped, specific `SuggestionFailure` as execute (slice 06) — not a blanket
 *  string — so both paths surface the reason + offending value identically. */
export type EstimateState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly result: EstimateResult
      /** Client-side stamp (epoch ms, `Date.now()`) of when the quote resolved
       *  (slice 07). Drives the live "updated Ns ago" marker + the staleness gate. */
      readonly producedAt: number
    }
  | { readonly phase: 'error'; readonly error: SuggestionFailure }

/**
 * A user-facing suggestion failure mapped from a server error (slice 06/09).
 * `title` is the headline, `detail` the single lead line. `details` carries the
 * full per-issue list for a 422 — each server `issues[]` entry, already specific
 * and value-bearing (which symbol, which leverage cap, the exact shortfall) — so
 * multiple validation reasons surface together instead of collapsing to one.
 * `retryable` preserves the retry vs. fix/top-up distinction (network/5xx retry;
 * 422 validation and 402 balance do not).
 */
export interface SuggestionFailure {
  readonly title: string
  readonly detail: string
  readonly details: readonly string[]
  readonly retryable: boolean
}

/**
 * Back-compat alias (slice 06): the execute lifecycle still names its failure
 * `ExecuteError`, but it is the same shape the estimate path now shares.
 */
export type ExecuteError = SuggestionFailure

/**
 * The execute-step lifecycle. `loading` is the brief accept-POST beat; `pending`
 * (ADR-0073) is the durable async job in flight — the sheet shows the "working,
 * you can close this" copy and is freely closable until the inbox toast fires.
 */
export type ExecuteState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'pending'; readonly suggestionId: string }
  | { readonly phase: 'error'; readonly error: ExecuteError }

/** The delegation gate the Execute affordance respects (slice 06/09). */
export type DelegationGate = 'unknown' | 'active' | 'needs-grant'

/**
 * The persistent Agent Balance shown in the sheet at all times (slice 08).
 * `display` is the reconciled USD figure: the live `useAgentBalance` reading
 * before/while an estimate is pending, superseded by the estimate's
 * quote-time `agentBalanceUsd` once a quote is `ready` (the authoritative
 * figure the server priced against). `showTopUp` surfaces the existing top-up
 * affordance when the current/last ready estimate reports an insufficient
 * balance. `scopedVenueId` records the DEX the figure is scoped to (slice 04):
 * the reading is venue-independent on-chain Base USDC, so re-scoping happens by
 * the estimate lifecycle resetting on venue change, not by re-parameterizing
 * the read.
 */
export interface PersistentBalanceViewModel {
  readonly display: string
  /**
   * Whether the live on-chain balance read is still in flight (slice 12) — shows
   * a placeholder instead of the pre-read `$0.00`. Only ever true when the live
   * reading is the source: once a ready quote supersedes it, the balance is known.
   */
  readonly isLoading: boolean
  /**
   * Whether the live on-chain balance read failed — shows an explicit
   * "Unavailable" instead of the pre-read `$0.00`. Like `isLoading`, only ever
   * true while the live reading is the source: a ready quote supersedes it.
   */
  readonly isError: boolean
  readonly showTopUp: boolean
  readonly scopedVenueId: SuggestionVenueId
  onTopUp(): void
}

/** Injected deps so the sheet is testable without network / cross-module hooks. */
export interface PerpSuggestionSheetDeps {
  readonly estimateSuggestion?: EstimateSuggestion
  readonly executeSuggestion?: ExecuteSuggestion
  readonly getHistory?: GetSuggestionHistory
  /** The server token allowlist for the selected DEX (slice 05). */
  readonly getMarkets?: GetSuggestionMarkets
  readonly getDelegationStatus?: () => Promise<DelegationStatusView>
  readonly openDelegationConsent?: () => void
  /** Override the sheet-owned last-used-symbol store (ADR-0056) in tests. */
  readonly symbolStore?: SuggestionSymbolStore
  /** Inject the clock so the freshness marker + staleness gate are deterministic
   *  in tests (slice 07). Defaults to `Date.now`. */
  readonly now?: () => number
  /** Inject the per-second ticker so the marker advances without real timers in
   *  tests (slice 07). Defaults to `setInterval`; mirrors `clearInterval`. */
  readonly createInterval?: (
    handler: () => void,
    ms: number,
  ) => { clear: () => void }
  /** Inject the agent-balance reading hook (slice 08) so the persistent balance
   *  is testable without viem / Privy / HTTP. Defaults to the agent-balance
   *  module's public `useAgentBalance`. */
  readonly useAgentBalance?: () => AgentBalanceViewModel
}

export interface PerpSuggestionSheetProps {
  readonly deps?: PerpSuggestionSheetDeps
}

/** The left-edge AI toggle's props. `hidden` slides it off the left edge while
 *  the AccountDock is scrolled into its row, so it never covers the dock table;
 *  TradingPage owns the detection (IntersectionObserver on the dock pane). */
export interface PerpSuggestionToggleProps {
  readonly hidden?: boolean
}

/** What the History tab needs (slice 11). */
export type HistoryState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly rows: readonly StoredSuggestion[]
      /** Wall-clock captured when the read resolved — drives per-row expiry
       *  without an impure `Date.now()` during render. */
      readonly nowMs: number
    }
  | { readonly phase: 'error'; readonly message: string }

export interface UsePerpSuggestionSheetContentReturn {
  readonly isOpen: boolean
  close(): void
  readonly isConnected: boolean
  /** The terminal's currently-selected market — marks the header asset icon so
   *  the sheet shows which market it was opened against. */
  readonly currentMarket: Market
  readonly tab: SheetTab
  setTab(tab: SheetTab): void
  readonly dexOptions: readonly DexOption[]
  /** The sheet-owned DEX scope (slice 04). Default `hyperliquid`. */
  readonly selectedVenueId: SuggestionVenueId
  selectVenue(venueId: SuggestionVenueId): void
  readonly agents: readonly AgentDescriptor[]
  readonly selectedAgentId: AgentId
  selectAgent(agentId: AgentId): void
  readonly agent: AgentDescriptor
  readonly paramForm: AgentParamFormViewModel
  /** The six ordered Suggest steps with their derived progress state (slice 09).
   *  The dumb `SuggestStepper` renders these; the hook owns the derivation. */
  readonly steps: readonly SuggestStep[]
  /** Opt-in prefill: seed the sheet's symbol from the terminal's selected
   *  market (ADR-0056). The only sanctioned Trade Page coupling. */
  onUseCurrentMarket(): void
  readonly estimate: EstimateState
  onEstimate(): void
  /** Whether the Estimate affordance is enabled: the params validate AND no
   *  estimate is already in flight. Gates the Estimate button so a pristine $0
   *  margin can't price a call. */
  readonly canEstimate: boolean
  /** Whether the ready estimate has aged past the grace period (slice 07). When
   *  true, execute is blocked and the action button forces a re-estimate. */
  readonly isEstimateStale: boolean
  /** The live "updated Ns ago" marker for the ready estimate, or `null` when no
   *  ready estimate exists (slice 07). Ticks ~once per second. */
  readonly estimateAgeLabel: string | null
  readonly execute: ExecuteState
  onExecute(): void
  readonly canExecute: boolean
  /** Whether the loading beat's icon animates (false under reduced-motion). */
  readonly loadingAnimated: boolean
  readonly delegationGate: DelegationGate
  onGrantAccess(): void
  onTopUp(): void
  /** The persistent, always-visible Agent Balance (slice 08), reconciled with
   *  the estimate's quote-time figure. */
  readonly agentBalance: PersistentBalanceViewModel
  readonly history: HistoryState
  onReopenHistory(row: StoredSuggestion): void
}

export interface AgentPickerProps {
  readonly agents: readonly AgentDescriptor[]
  readonly selectedAgentId: AgentId
  readonly onSelect: (agentId: AgentId) => void
}

export interface DexSelectorProps {
  readonly options: readonly DexOption[]
  readonly selectedVenueId: SuggestionVenueId
  readonly onSelect: (venueId: SuggestionVenueId) => void
}

export interface AgentIconProps {
  readonly kind: AgentIconKind
  /** Animate (loading beat) vs. show the static decoded frame (at rest). */
  readonly animated?: boolean
  readonly size?: number
  readonly className?: string
}

export interface AgentFieldProps {
  readonly field: AgentFieldSchema
  readonly form: AgentParamFormViewModel
}

/** One asset-class section of the grouped Market dropdown (ADR-0062): the
 *  category, its display label, and the matching tokens in catalog order. */
export interface SuggestionTokenGroup {
  readonly category: MarketCategory
  readonly label: string
  readonly tokens: readonly SuggestionToken[]
}

/**
 * One flat row in the virtualized Market dropdown (OPT-2, ADR-0019). The grouped
 * sections are flattened into a single discriminated list so one virtualizer can
 * window headers and token rows together: a `header` carries its asset-class
 * `category` + display `label`; a `token` carries the offerable `SuggestionToken`.
 */
export type SuggestionListRow =
  | { readonly kind: 'header'; readonly category: MarketCategory; readonly label: string }
  | { readonly kind: 'token'; readonly token: SuggestionToken }

/** The token-list search hook's return (slice 05). The list is a combobox: a
 *  searchbar plus a dropdown of matches that opens on focus / typing. */
export interface UseSuggestionTokenListReturn {
  readonly query: string
  readonly filteredTokens: readonly SuggestionToken[]
  /** The filtered tokens grouped by asset class, in Minara's tab order — what
   *  the open dropdown renders as labelled sections (ADR-0062). */
  readonly groupedTokens: readonly SuggestionTokenGroup[]
  /** The grouped dropdown flattened into a single discriminated row list (headers
   *  + tokens) so one virtualizer can window the whole catalog (OPT-2, ADR-0019). */
  readonly displayRows: readonly SuggestionListRow[]
  /** The `Market` of the current selection (resolved from the offered tokens),
   *  for the icon shown in the collapsed combobox. `null` when unmatched. */
  readonly selectedMarket: Market | null
  /** Whether the results dropdown is open (focus or typing opens it). */
  readonly isOpen: boolean
  /** Wraps the field so a pointer-down outside it closes the dropdown. */
  readonly containerRef: RefObject<HTMLDivElement | null>
  /** Ref forwarded to the dropdown's scroll viewport — the virtualizer's scroll
   *  element (OPT-2, ADR-0019). */
  readonly scrollRef: RefObject<HTMLDivElement | null>
  /** Virtualizer for the flat `displayRows` list (OPT-2, ADR-0019). The component
   *  consumes `getVirtualItems()` + `getTotalSize()` and indexes into `displayRows`. */
  readonly virtualizer: Virtualizer<HTMLDivElement, Element>
  onSearchChange(query: string): void
  /** Select a token: routes to the parent `onSelect`, then clears + closes. */
  onSelectToken(symbol: string): void
  /** Open the dropdown (input focus). */
  onOpen(): void
  /** Key handling on the input — Escape closes the dropdown. */
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void
}

/** The searchable token list component's props (slice 05). Dumb — fed by the
 *  param-form view-model; selection routes back to the sheet's `setSymbol`. */
export interface SuggestionTokenListProps {
  readonly label: string
  readonly tokens: readonly SuggestionToken[]
  /** Whether the offered tokens are still loading (slice 12) — the open dropdown
   *  shows a skeleton instead of the empty-state copy while true. */
  readonly isLoading: boolean
  readonly selectedSymbol: string
  onSelect(symbol: string): void
}

/** One token row's props (slice 05). Dumb leaf — renders the icon + symbol. */
export interface SuggestionTokenRowProps {
  readonly token: SuggestionToken
  readonly selected: boolean
  onSelect(symbol: string): void
}

/** One flat virtualized dropdown row (OPT-2): a section header or a token button.
 *  Dumb leaf — fed a single `SuggestionListRow` by the windowing parent. */
export interface SuggestionListRowViewProps {
  readonly row: SuggestionListRow
  readonly selectedSymbol: string
  onSelect(symbol: string): void
}

export interface AgentParamFormProps {
  readonly agent: AgentDescriptor
  readonly form: AgentParamFormViewModel
}

export interface SuggestActionsProps {
  readonly isConnected: boolean
  readonly estimate: EstimateState
  readonly execute: ExecuteState
  /** Whether Estimate is enabled (valid params + not already estimating). */
  readonly canEstimate: boolean
  readonly canExecute: boolean
  /** Whether the ready estimate is stale (slice 07) — drives the Re-estimate
   *  swap in place of Execute. */
  readonly isEstimateStale: boolean
  /** The live "updated Ns ago" marker rendered next to cost (slice 07). */
  readonly estimateAgeLabel: string | null
  readonly delegationGate: DelegationGate
  onEstimate(): void
  onExecute(): void
  onGrantAccess(): void
}

export interface AgentWorkingLoaderProps {
  readonly iconKind: AgentIconKind
  readonly agentLabel: string
  /** Drives the animated icon frame; false → static frame (reduced-motion). */
  readonly animated: boolean
}

/** The async-pending working beat's props (ADR-0073). Dumb — the job is in
 *  flight and the user can close the sheet while it resolves. */
export interface SuggestPendingNoticeProps {
  readonly iconKind: AgentIconKind
  /** Drives the animated icon frame; false → static frame (reduced-motion). */
  readonly animated: boolean
}

export interface SuggestTabProps {
  readonly vm: UsePerpSuggestionSheetContentReturn
}

export interface HistoryTabProps {
  readonly history: HistoryState
  onReopen(row: StoredSuggestion): void
}

export interface HistoryRowProps {
  readonly row: StoredSuggestion
  readonly expired: boolean
  onReopen(row: StoredSuggestion): void
}

export interface SuggestionHeaderChild {
  readonly children: ReactNode
}

/** The persistent Agent Balance footer's props (slice 08). Dumb — fed by the
 *  sheet hook's reconciled `agentBalance` view-model. */
export interface SheetAgentBalanceProps {
  readonly balance: PersistentBalanceViewModel
}
