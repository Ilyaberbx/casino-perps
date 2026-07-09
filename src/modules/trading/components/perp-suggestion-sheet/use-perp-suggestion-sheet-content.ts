import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { useAuth, useIsWalletConnected } from '@/modules/account'
import {
  resolveDefaultGetDelegationStatus,
  useAgentBalance,
  useAgentBalanceSheet,
} from '@/modules/agent-balance'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { useIsVenueOnboardingReady } from '@/modules/shared/hooks/use-is-venue-onboarding-ready'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { useToast } from '@/modules/shared/providers/toast-provider'
import { usePrefersReducedMotion } from '@/modules/shared/hooks/use-prefers-reduced-motion'
import { requestIdFrom } from '@/modules/shared/http'
import { logger } from '@/app/logger'
import { resolveDefaultEstimateSuggestion } from '../../api/estimate-suggestion'
import { resolveDefaultExecuteSuggestion } from '../../api/execute-suggestion'
import { resolveDefaultGetSuggestionHistory } from '../../api/get-suggestion-history'
import { resolveDefaultGetSuggestionMarkets } from '../../api/get-suggestion-markets'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { usePerpSuggestionSheet } from '../../providers/perp-suggestion-sheet-provider'
import { useSuggestionPreviewSheet } from '../../providers/suggestion-preview-provider'
import { useSuggestionInbox } from '../../providers/suggestion-inbox-provider'
import { createSuggestionSymbolStore } from '../../services/suggestion-symbol-store'
import { iconWarmCache } from '@/modules/shared/services/icon-warm-cache'
import { collectIconWarmUrls } from '../market-selection-window/market-selection-window.utils'
import { useAgentParamForm } from './use-agent-param-form'
import { MINARA_CATALOG_SYMBOLS } from './minara-catalog.constants'
import {
  AI_AGENTS,
  DEFAULT_SUGGESTION_SYMBOL,
  MINARA_AGENT,
} from './ai-agents.constants'
import { MIN_MARKET_VOLUME_USD } from '../../trading.constants'
import {
  DEFAULT_AGENT_ID,
  DEFAULT_TAB,
  EMPTY_MARKETS,
  ESTIMATE_GRACE_PERIOD_MS,
} from './perp-suggestion-sheet.constants'
import { DEFAULT_VENUE_ID, DEX_OPTIONS } from './dex-options.constants'
import {
  baseSymbolOfMarket,
  buildMinaraCatalogTokens,
  filterTokensByVenueLiquidity,
  deriveSuggestSteps,
  formatUpdatedAgo,
  isEstimateStale as computeIsEstimateStale,
  isExpired,
  mapSuggestionError,
  maxLeverageForSymbol,
} from './perp-suggestion-sheet.utils'
import type { AgentDescriptor, AgentId } from './ai-agents.types'
import type {
  StoredSuggestion,
  SuggestionVenueId,
} from '../../api/suggestions.types'
import type {
  DelegationGate,
  EstimateState,
  ExecuteState,
  HistoryState,
  PerpSuggestionSheetDeps,
  PersistentBalanceViewModel,
  SheetTab,
  UsePerpSuggestionSheetContentReturn,
} from './perp-suggestion-sheet.types'

const MINARA_AGENT_ID = 'minara'
const log = logger.child({ module: 'ai-suggestion-sheet' })

/**
 * The AI Sheet orchestrator (ADR-0048). Owns the tab + selected agent, delegates
 * the param form to `useAgentParamForm`, runs the estimate → execute lifecycle,
 * gates Execute on connection + delegation + estimate + balance, and hands a
 * successful raw suggestion to the right-side preview. Reaches the engine ONLY
 * through `trading/api`; reuses `agent-balance` for the delegation gate.
 */
export function usePerpSuggestionSheetContent(
  deps?: PerpSuggestionSheetDeps,
): UsePerpSuggestionSheetContentReturn {
  const { isOpen, close } = usePerpSuggestionSheet()
  const isConnected = useIsWalletConnected()
  const { apiClient } = useAuth()
  // The terminal selection drives the opt-in "use current market" prefill
  // (ADR-0056) — never seeding/validating by default — and the header asset
  // icon (`currentMarket`) that marks which market the sheet is opened against.
  const { selectedMarket, market: currentMarket } = useSelectedMarketContext()
  const portfolioCap = useCapabilityOptional('portfolio')
  const marketDataCap = useCapabilityOptional('marketData')
  // Slice 07: the AI-suggestion execute path consumes the SAME venue-onboarding
  // predicate the Place-Order submit gate uses (ADR-0026), keyed (via the agent/
  // builder/deposit re-key) to the Selected Wallet — so a suggestion cannot
  // execute onto a venue the Selected Wallet isn't onboarded for. When not ready,
  // execute opens the existing onboarding sheet instead of placing the order.
  const isVenueOnboardingReady = useIsVenueOnboardingReady()
  const venueOnboardingSheet = useVenueOnboardingSheet()
  const preview = useSuggestionPreviewSheet()
  // The app-level inbox controller (ADR-0073): `watch` registers a fired
  // suggestion id so its async resolution toasts; `historyDirtyVersion` bumps on
  // a watched completion so an open History tab refetches.
  const { watch, historyDirtyVersion } = useSuggestionInbox()
  const agentBalanceSheet = useAgentBalanceSheet()
  // The persistent Agent Balance reading (slice 08) — venue-independent Base
  // USDC, read through the agent-balance module's public hook (never a deep
  // import of its internals). Injectable so the persistent balance is testable
  // without viem / Privy / HTTP.
  const useAgentBalanceReading = deps?.useAgentBalance ?? useAgentBalance
  const liveAgentBalance = useAgentBalanceReading()
  const toast = useToast()
  const prefersReducedMotion = usePrefersReducedMotion()

  const estimateSuggestion = useMemo(
    () => deps?.estimateSuggestion ?? resolveDefaultEstimateSuggestion(apiClient),
    [deps, apiClient],
  )
  const executeSuggestion = useMemo(
    () => deps?.executeSuggestion ?? resolveDefaultExecuteSuggestion(apiClient),
    [deps, apiClient],
  )
  const getHistory = useMemo(
    () => deps?.getHistory ?? resolveDefaultGetSuggestionHistory(apiClient),
    [deps, apiClient],
  )
  const getDelegationStatus = useMemo(
    () =>
      deps?.getDelegationStatus ??
      resolveDefaultGetDelegationStatus(apiClient, MINARA_AGENT_ID),
    [deps, apiClient],
  )
  const getMarkets = useMemo(
    () => deps?.getMarkets ?? resolveDefaultGetSuggestionMarkets(apiClient),
    [deps, apiClient],
  )
  const openDelegationConsent =
    deps?.openDelegationConsent ?? agentBalanceSheet.openDelegation

  // The clock + ticker are injectable so the freshness marker + staleness gate
  // are deterministic in tests (testing.md — never depend on real wall-clock).
  // Memoized so the default ticker keeps a stable identity (the marker effect
  // depends on it — a fresh closure each render would re-subscribe every render).
  const now = useMemo(() => deps?.now ?? Date.now, [deps])
  const createInterval = useMemo(
    () =>
      deps?.createInterval ??
      ((handler: () => void, ms: number) => {
        const id = setInterval(handler, ms)
        return { clear: () => clearInterval(id) }
      }),
    [deps],
  )

  const [tab, setTab] = useState<SheetTab>(DEFAULT_TAB)
  const [selectedVenueId, setSelectedVenueId] =
    useState<SuggestionVenueId>(DEFAULT_VENUE_ID)
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>(DEFAULT_AGENT_ID)
  const [collateralUsd, setCollateralUsd] = useState<number | null>(null)
  const [estimate, setEstimate] = useState<EstimateState>({ phase: 'idle' })
  const [execute, setExecute] = useState<ExecuteState>({ phase: 'idle' })
  const [delegationGate, setDelegationGate] = useState<DelegationGate>('unknown')
  const [history, setHistory] = useState<HistoryState>({ phase: 'loading' })

  const agent: AgentDescriptor =
    AI_AGENTS.find((a) => a.id === selectedAgentId) ?? MINARA_AGENT

  // Sheet-owned symbol persistence (ADR-0056): the default comes from the
  // last-used symbol, never the terminal selection. The store is created once.
  const symbolStore = useMemo(
    () => deps?.symbolStore ?? createSuggestionSymbolStore(),
    [deps],
  )
  const defaultSymbol = useMemo(
    () => symbolStore.load() ?? DEFAULT_SUGGESTION_SYMBOL,
    [symbolStore],
  )
  const persistSymbol = useCallback(
    (symbol: string) => symbolStore.save(symbol),
    [symbolStore],
  )

  // Subscribe to the venue's live market list the SAME way the Market Selection
  // window does (`useSyncExternalStore`) so the offered token set converges as
  // markets stream in. This is the single-source-of-truth wiring (ADR-0064): the
  // token list is gated against this list's liquid set, so a venue market the
  // window hides as illiquid can never appear in the AI feed. Optional capability
  // → a frozen empty list when no venue is mounted (keeps `getSnapshot` stable).
  const subscribeVenueMarkets = useCallback(
    (onChange: () => void) =>
      marketDataCap ? marketDataCap.subscribeMarkets(onChange) : () => {},
    [marketDataCap],
  )
  const getVenueMarkets = useCallback(
    () => (marketDataCap ? marketDataCap.listMarkets() : EMPTY_MARKETS),
    [marketDataCap],
  )
  const venueMarkets = useSyncExternalStore(subscribeVenueMarkets, getVenueMarkets)

  // Leverage cap resolves from the sheet's OWN selected symbol against the
  // venue market list (ADR-0056) — not the terminal market.
  const resolveMarketMaxLeverage = useCallback(
    (symbol: string): number | undefined =>
      marketDataCap ? maxLeverageForSymbol(marketDataCap.listMarkets(), symbol) : undefined,
    [marketDataCap],
  )

  // The server-advertised allowlist for the selected DEX (slice 03/05). Seeded
  // with — and falling back to — Minara's full catalog (ADR-0062) so the sheet
  // always offers the whole universe even when the fetch fails; the server is
  // still the final authority on execute.
  const [allowlist, setAllowlist] =
    useState<readonly string[]>(MINARA_CATALOG_SYMBOLS)
  // The allowlist fetch phase drives the token-list loading state (slice 12).
  // 'loading' is set during render (the same converger idiom as the delegation /
  // history gates) — keyed on the open venue — so the effect only setStates in
  // its async resolution, never synchronously (React 19 / React Compiler).
  const [allowlistPhase, setAllowlistPhase] = useState<'loading' | 'ready'>('loading')
  const allowlistKey = isOpen ? selectedVenueId : null
  const [allowlistKeySeen, setAllowlistKeySeen] = useState<SuggestionVenueId | null>(
    null,
  )
  if (allowlistKey !== allowlistKeySeen) {
    setAllowlistKeySeen(allowlistKey)
    if (allowlistKey !== null) setAllowlistPhase('loading')
  }
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    getMarkets(selectedVenueId).match(
      (result) => {
        if (cancelled) return
        setAllowlist(result.symbols)
        setAllowlistPhase('ready')
      },
      (error) => {
        if (cancelled) return
        const requestId = requestIdFrom(error)
        log.warn(
          { kind: error.kind, venueId: selectedVenueId, ...(requestId ? { requestId } : {}) },
          'markets allowlist fetch failed',
        )
        setAllowlist(MINARA_CATALOG_SYMBOLS)
        setAllowlistPhase('ready')
      },
    )
    return () => {
      cancelled = true
    }
  }, [isOpen, selectedVenueId, getMarkets])

  // The token list is "loading" while the sheet is open and either the allowlist
  // fetch is in flight or the venue's market list hasn't arrived yet (slice 12) —
  // so the picker shows a skeleton instead of the full-catalog superset that
  // would visibly NARROW the instant the venue list lands. A sheet with no venue
  // capability mounted is never "loading" (the catalog superset is the floor).
  const isVenueListPending = marketDataCap !== undefined && venueMarkets.length === 0
  const isAllowlistPending = allowlistPhase === 'loading'
  const isMarketsLoading = isOpen && (isAllowlistPending || isVenueListPending)

  // The offerable token list: Minara's full catalog (ADR-0062), gated by the
  // allowlist so the client never offers a symbol the server 422s, THEN gated by
  // the venue's liquid set (ADR-0064) so a venue market hidden in the Market
  // Selection window can never appear here. Non-venue catalog symbols (stocks,
  // commodities, …) pass through as the deliberate AI-only superset; with no
  // venue list yet, the full catalog shows (stability fallback).
  const tokens = useMemo(
    () =>
      filterTokensByVenueLiquidity(
        buildMinaraCatalogTokens(allowlist),
        venueMarkets,
        MIN_MARKET_VOLUME_USD,
      ),
    [allowlist, venueMarkets],
  )

  // Warm every offered token's icon on idle once the sheet opens — the exact
  // Market Selection path (reuses iconWarmCache + collectIconWarmUrls). No-op in
  // jsdom (no requestIdleCallback). No parallel cache.
  useEffect(() => {
    if (!isOpen || tokens.length === 0) return
    return iconWarmCache.warmMany(
      collectIconWarmUrls(tokens.map((token) => token.market)),
    )
  }, [isOpen, tokens])

  const paramForm = useAgentParamForm({
    defaultSymbol,
    tokens,
    tokensLoading: isMarketsLoading,
    availableCollateralUsd: collateralUsd,
    resolveMarketMaxLeverage,
    onSymbolChange: persistSymbol,
  })

  // The ONLY sanctioned terminal read (ADR-0056): opt-in prefill, on click only.
  const onUseCurrentMarket = useCallback(() => {
    const markets = marketDataCap ? marketDataCap.listMarkets() : []
    paramForm.setSymbol(baseSymbolOfMarket(markets, selectedMarket))
  }, [marketDataCap, paramForm, selectedMarket])

  // Live perp collateral feeds the margin slider cap (ADR-0033 'perps' scope).
  useEffect(() => {
    if (!isOpen) return
    if (!portfolioCap) return
    return portfolioCap.subscribeSnapshot('perps', (snapshot) => {
      setCollateralUsd(snapshot.accountValue)
    })
  }, [isOpen, portfolioCap])

  // Reset the gate to 'unknown' whenever the sheet is closed or disconnected —
  // during render (converges via `delegationKey`), so the effect below only
  // setStates in its async resolution.
  const delegationActive = isOpen && isConnected
  const [delegationKey, setDelegationKey] = useState(false)
  if (delegationActive !== delegationKey) {
    setDelegationKey(delegationActive)
    if (!delegationActive) setDelegationGate('unknown')
  }

  // Read the per-agent delegation status to drive the Execute gate.
  useEffect(() => {
    if (!delegationActive) return
    let cancelled = false
    getDelegationStatus().then((status) => {
      if (cancelled) return
      setDelegationGate(status.status === 'active' ? 'active' : 'needs-grant')
    })
    return () => {
      cancelled = true
    }
  }, [delegationActive, getDelegationStatus])

  // Show the History loading state during render (not synchronously in the
  // effect — matching the delegation effect, which only setStates in its async
  // resolution). `historyLoadKey` converges to `historyActive`, so this
  // self-terminates without an effect or a cascading render.
  const historyActive = isOpen && tab === 'history'
  const [historyLoadKey, setHistoryLoadKey] = useState(false)
  if (historyActive !== historyLoadKey) {
    setHistoryLoadKey(historyActive)
    if (historyActive) setHistory({ phase: 'loading' })
  }

  // Refetch the open History tab on window focus so a completion that arrived
  // while the tab was elsewhere shows on return (ADR-0073). A bump counter the
  // load effect depends on; the listener is active only while the tab is open.
  const [historyFocusTick, setHistoryFocusTick] = useState(0)
  useEffect(() => {
    if (!historyActive) return
    const onFocus = () => setHistoryFocusTick((tick) => tick + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [historyActive])

  // Load the aggregated history when the History tab opens, and re-load when the
  // inbox provider's history-dirty signal bumps (a watched completion landed) or
  // on window focus — so a completion that arrived while the tab was closed
  // shows on next open / return.
  useEffect(() => {
    if (!historyActive) return
    let cancelled = false
    getHistory().match(
      (rows) => {
        if (!cancelled) setHistory({ phase: 'ready', rows, nowMs: Date.now() })
      },
      () => {
        if (!cancelled) setHistory({ phase: 'error', message: 'Could not load history.' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [historyActive, getHistory, historyDirtyVersion, historyFocusTick])

  // The DEX scope (slice 04). Selecting a live venue resets the estimate/execute
  // lifecycle (the quote is venue-scoped); a coming-soon venue is never selected.
  const selectVenue = useCallback((venueId: SuggestionVenueId) => {
    const target = DEX_OPTIONS.find((dex) => dex.id === venueId)
    const isSelectable = target !== undefined && !target.comingSoon
    if (!isSelectable) return
    setSelectedVenueId(venueId)
    setEstimate({ phase: 'idle' })
    setExecute({ phase: 'idle' })
  }, [])

  const selectAgent = useCallback((agentId: AgentId) => {
    const target = AI_AGENTS.find((a) => a.id === agentId)
    const isSelectable = target !== undefined && target.enabled
    if (!isSelectable) return
    setSelectedAgentId(agentId)
    setEstimate({ phase: 'idle' })
    setExecute({ phase: 'idle' })
  }, [])

  const onEstimate = useCallback(() => {
    if (!paramForm.isValid) {
      toast.show({ variant: 'error', title: 'Fix the request before estimating' })
      return
    }
    setEstimate({ phase: 'loading' })
    estimateSuggestion({
      agentId: selectedAgentId,
      venueId: selectedVenueId,
      params: paramForm.toParams(),
    }).match(
      (result) =>
        // Stamp the quote with a client-side `producedAt` (slice 07) so the
        // freshness marker + grace-period gate can age it.
        setEstimate({ phase: 'ready', result, producedAt: now() }),
      (error) => {
        // Mirror the execute path (slice 06): surface the specific reason +
        // every server issue line, not a blanket "Could not price this call."
        const mapped = mapSuggestionError(error)
        const requestId = requestIdFrom(error)
        log.warn(
          { kind: error.kind, title: mapped.title, ...(requestId ? { requestId } : {}) },
          'estimate failed',
        )
        setEstimate({ phase: 'error', error: mapped })
      },
    )
  }, [paramForm, estimateSuggestion, selectedAgentId, selectedVenueId, toast, now])

  // A per-second tick drives the live "updated Ns ago" marker. The hook owns the
  // interval (never the dumb component); it runs ONLY while a ready estimate
  // exists and is cleaned up on unmount / when the estimate leaves 'ready'.
  // `nowTick` re-syncs to the current clock during render whenever a NEW quote
  // resolves (tracked by `producedAt` identity) — the render-time converger idiom
  // used elsewhere in this hook, so the effect never setStates synchronously
  // (React 19 / React Compiler — no cascading renders).
  const hasReadyEstimate = estimate.phase === 'ready'
  const producedAt = estimate.phase === 'ready' ? estimate.producedAt : null
  const [nowTick, setNowTick] = useState<number>(() => now())
  const [tickStampKey, setTickStampKey] = useState<number | null>(producedAt)
  if (producedAt !== tickStampKey) {
    setTickStampKey(producedAt)
    if (producedAt !== null) setNowTick(now())
  }
  useEffect(() => {
    if (!hasReadyEstimate) return
    const handle = createInterval(() => setNowTick(now()), 1_000)
    return () => handle.clear()
  }, [hasReadyEstimate, createInterval, now])

  // Staleness gate (slice 07): a ready quote older than the grace period blocks
  // execute and forces an explicit, free re-estimate. Precedence: stale wins over
  // sufficiency — a sufficient-but-stale quote still demands a re-estimate.
  const isEstimateStale =
    estimate.phase === 'ready' &&
    computeIsEstimateStale(estimate.producedAt, nowTick, ESTIMATE_GRACE_PERIOD_MS)
  const estimateAgeLabel =
    estimate.phase === 'ready'
      ? formatUpdatedAgo(estimate.producedAt, nowTick)
      : null

  // Estimate is enabled only when the params validate and no estimate is already
  // in flight — so a pristine $0 margin (invalid) keeps the Estimate button gated.
  const canEstimate = paramForm.isValid && estimate.phase !== 'loading'

  const isEstimatedSufficient =
    estimate.phase === 'ready' && estimate.result.sufficient
  const canExecute =
    isConnected &&
    isVenueOnboardingReady &&
    delegationGate === 'active' &&
    isEstimatedSufficient &&
    !isEstimateStale &&
    paramForm.isValid &&
    execute.phase !== 'loading'

  const onExecute = useCallback(() => {
    // Venue-onboarding gate (slice 07): a suggestion cannot execute onto a venue
    // the Selected Wallet isn't onboarded for. Run the existing onboarding sheet
    // instead of placing the order (reuses the ADR-0026 gate, no new gating).
    if (!isVenueOnboardingReady) {
      venueOnboardingSheet.open()
      return
    }
    if (!canExecute) {
      toast.show({ variant: 'error', title: 'Estimate first and ensure a sufficient balance' })
      return
    }
    setExecute({ phase: 'loading' })
    executeSuggestion({
      agentId: selectedAgentId,
      venueId: selectedVenueId,
      params: paramForm.toParams(),
    }).match(
      (accepted) => {
        // ADR-0073 D-1: a `completed` dedup hit returns the cached suggestion —
        // render it inline as before, no waiting. Otherwise the durable job is in
        // flight: register the id with the inbox provider (which toasts on
        // resolution, surviving sheet-close / reload) and switch to the working
        // state. The sheet stays closable immediately.
        if (accepted.status === 'completed') {
          setExecute({ phase: 'idle' })
          preview.open({ suggestion: accepted.suggestion, readOnly: false })
          return
        }
        watch(accepted.suggestionId)
        setExecute({ phase: 'pending', suggestionId: accepted.suggestionId })
      },
      (error) => {
        // The accept POST itself failed (genuine connectivity / validation /
        // balance) — keep the existing mapping. A failed async OUTCOME never
        // reaches here; the inbox provider surfaces it as its own error toast.
        const mapped = mapSuggestionError(error)
        const requestId = requestIdFrom(error)
        log.warn(
          { kind: error.kind, title: mapped.title, ...(requestId ? { requestId } : {}) },
          'execute failed',
        )
        setExecute({ phase: 'error', error: mapped })
        toast.show({ variant: 'error', title: mapped.title, description: mapped.detail })
      },
    )
  }, [
    canExecute,
    isVenueOnboardingReady,
    venueOnboardingSheet,
    executeSuggestion,
    selectedAgentId,
    selectedVenueId,
    paramForm,
    preview,
    watch,
    toast,
  ])

  // If the watched id completes WHILE the sheet is still open, render it inline
  // (the provider still toasts). The inbox feed carries only outcome metadata, so
  // we re-read history (the source of the full `StoredSuggestion`) when the
  // provider's history-dirty signal bumps during a pending execute, and open the
  // matching row. Keyed on `historyDirtyVersion` so it fires once per completion.
  const pendingSuggestionId =
    execute.phase === 'pending' ? execute.suggestionId : null
  useEffect(() => {
    if (pendingSuggestionId === null) return
    if (historyDirtyVersion === 0) return
    let cancelled = false
    getHistory().match(
      (rows) => {
        if (cancelled) return
        const completed = rows.find((row) => row.id === pendingSuggestionId)
        if (!completed) return
        setExecute({ phase: 'idle' })
        preview.open({ suggestion: completed, readOnly: false })
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [pendingSuggestionId, historyDirtyVersion, getHistory, preview])

  const onGrantAccess = useCallback(() => {
    openDelegationConsent()
  }, [openDelegationConsent])

  const onTopUp = useCallback(() => {
    agentBalanceSheet.openDeposit()
  }, [agentBalanceSheet])

  // ---------------------------------------------------------------------------
  // Persistent Agent Balance (slice 08), reconciled with the estimate's
  // quote-time figure so the sheet never shows two contradictory numbers.
  //
  // Precedence (named, not implicit): the estimate's `agentBalanceUsd` is the
  // authoritative balance the server priced against, so it SUPERSEDES the live
  // reading once a quote is `ready`. Before that (idle / loading / error) — and
  // again when the venue change resets the estimate to idle (slice 04) — the
  // live, always-visible reading wins. The reading itself is venue-independent
  // (on-chain Base USDC), so re-scoping on a DEX switch happens via the estimate
  // lifecycle reset, not a re-parameterized read.
  const hasReadyQuote = estimate.phase === 'ready'
  const estimateBalanceSupersedes = hasReadyQuote
  const agentBalanceDisplay =
    estimateBalanceSupersedes && estimate.phase === 'ready'
      ? `$${estimate.result.agentBalanceUsd}`
      : liveAgentBalance.display
  // Top-up is offered only when a ready quote reports an insufficient balance —
  // the same trigger the post-estimate readout used, now lifted to the
  // persistent footer (reusing the existing `onTopUp` deposit path).
  const isQuoteInsufficient = hasReadyQuote && !isEstimatedSufficient
  // Loading is only meaningful while the live reading is the source: once a ready
  // quote supersedes the live figure, the balance the server priced against is
  // already known (slice 12).
  const isBalanceLoading =
    !estimateBalanceSupersedes && liveAgentBalance.status === 'loading'
  // Same precedence as loading: a failed live read only surfaces while the live
  // reading is the source — a ready quote carries the server-priced figure and
  // supersedes it. Shows an explicit "Unavailable" instead of a fake `$0.00`.
  const isBalanceError =
    !estimateBalanceSupersedes && liveAgentBalance.status === 'error'
  const agentBalance: PersistentBalanceViewModel = useMemo(
    () => ({
      display: agentBalanceDisplay,
      isLoading: isBalanceLoading,
      isError: isBalanceError,
      showTopUp: isQuoteInsufficient,
      scopedVenueId: selectedVenueId,
      onTopUp,
    }),
    [
      agentBalanceDisplay,
      isBalanceLoading,
      isBalanceError,
      isQuoteInsufficient,
      selectedVenueId,
      onTopUp,
    ],
  )

  const onReopenHistory = useCallback(
    (row: StoredSuggestion) => {
      preview.open({ suggestion: row, readOnly: isExpired(row.expiresAt) })
    },
    [preview],
  )

  // The six ordered Suggest steps (slice 09). Pure derivation over the flow facts
  // the hook already owns — the dumb `SuggestStepper` only renders the result.
  const hasToken = paramForm.values.symbol.trim().length > 0
  const hasFreshEstimate = estimate.phase === 'ready' && !isEstimateStale
  const isExecuting = execute.phase === 'loading'
  const steps = useMemo(
    () =>
      deriveSuggestSteps({
        hasToken,
        paramsValid: paramForm.isValid,
        hasFreshEstimate,
        canExecute,
        isExecuting,
      }),
    [hasToken, paramForm.isValid, hasFreshEstimate, canExecute, isExecuting],
  )

  return {
    isOpen,
    close,
    isConnected,
    currentMarket,
    tab,
    setTab,
    dexOptions: DEX_OPTIONS,
    selectedVenueId,
    selectVenue,
    agents: AI_AGENTS,
    selectedAgentId,
    selectAgent,
    agent,
    paramForm,
    steps,
    onUseCurrentMarket,
    estimate,
    onEstimate,
    canEstimate,
    isEstimateStale,
    estimateAgeLabel,
    execute,
    onExecute,
    canExecute,
    loadingAnimated: !prefersReducedMotion,
    delegationGate,
    onGrantAccess,
    onTopUp,
    agentBalance,
    history,
    onReopenHistory,
  }
}
