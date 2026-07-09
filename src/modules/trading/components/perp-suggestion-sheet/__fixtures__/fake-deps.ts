import { okAsync, errAsync } from 'neverthrow'
import { ApiError, type HttpError } from '@/modules/shared/http'
import type {
  AgentBalanceStatus,
  AgentBalanceViewModel,
  DelegationStatus,
} from '@/modules/agent-balance'
import type {
  EstimateResult,
  StoredSuggestion,
} from '../../../api/suggestions.types'
import type { EstimateSuggestion } from '../../../api/estimate-suggestion'
import type { ExecuteSuggestion } from '../../../api/execute-suggestion'
import type { GetSuggestionHistory } from '../../../api/get-suggestion-history'
import type { GetSuggestionMarkets } from '../../../api/get-suggestion-markets'
import type { PerpSuggestionSheetDeps } from '../perp-suggestion-sheet.types'
import { makeEstimateResult, makeStoredSuggestion } from './suggestions'

const DEFAULT_ALLOWLIST = ['BTC', 'ETH', 'SOL'] as const

export function fakeMarketsOk(
  symbols: readonly string[] = DEFAULT_ALLOWLIST,
): GetSuggestionMarkets {
  return (venueId) => okAsync({ venueId, symbols })
}

export function fakeMarketsErr(
  error: HttpError = new ApiError(500, '/api/suggestions/markets', null),
): GetSuggestionMarkets {
  return () => errAsync(error)
}

export function fakeEstimateOk(
  result: EstimateResult = makeEstimateResult(),
): EstimateSuggestion {
  return () => okAsync(result)
}

export function fakeEstimateErr(error: HttpError): EstimateSuggestion {
  return () => errAsync(error)
}

/**
 * Default execute fake: the durable async accept (ADR-0073) — `202` with
 * `status: 'pending'`. The sheet registers the id with the inbox provider and
 * switches to the working state; the result arrives later via a toast.
 */
export function fakeExecuteOk(suggestionId = 'sug-pending'): ExecuteSuggestion {
  return () => okAsync({ status: 'pending', suggestionId })
}

/** A `completed` dedup-hit accept: the cached suggestion is returned inline. */
export function fakeExecuteCompleted(
  suggestion: StoredSuggestion = makeStoredSuggestion(),
): ExecuteSuggestion {
  return () =>
    okAsync({ status: 'completed', suggestionId: suggestion.id, suggestion })
}

export function fakeExecuteErr(error: HttpError): ExecuteSuggestion {
  return () => errAsync(error)
}

export function fakeHistoryOk(
  rows: readonly StoredSuggestion[] = [],
): GetSuggestionHistory {
  return () => okAsync(rows)
}

export function fakeHistoryErr(
  error: HttpError = new ApiError(500, '/api/suggestions/history', null),
): GetSuggestionHistory {
  return () => errAsync(error)
}

/**
 * A fake of the agent-balance public hook (slice 08): returns a fixed live
 * Base-USDC reading so the persistent balance is deterministic without viem /
 * Privy / HTTP. Pass `null` for the disconnected / unread case (`$0.00`). The
 * `status` defaults to `ready` for a number reading (`idle` for `null`); pass it
 * explicitly to drive the loading state (slice 12).
 */
export function fakeAgentBalance(
  balanceUsd: number | null = 10,
  status: AgentBalanceStatus = balanceUsd === null ? 'idle' : 'ready',
): () => AgentBalanceViewModel {
  const display = balanceUsd === null ? '$0.00' : `$${balanceUsd.toFixed(2)}`
  return () => ({ balanceUsd, display, status, agentWalletAddress: null })
}

export interface FakeDepsOptions {
  readonly estimate?: EstimateSuggestion
  readonly execute?: ExecuteSuggestion
  readonly history?: GetSuggestionHistory
  readonly markets?: GetSuggestionMarkets
  readonly delegationStatus?: string
  readonly onGrantAccess?: () => void
  /** Inject the live agent-balance reading (slice 08). Defaults to a fixed
   *  $10.00 reading; pass a fake to drive the reconciliation tests. */
  readonly useAgentBalance?: () => AgentBalanceViewModel
  /** Inject the freshness clock (slice 07) so the staleness gate is deterministic. */
  readonly now?: () => number
  /** Inject the per-second ticker (slice 07) so the marker advances without real
   *  timers. Returns a handle whose `tick()` fires the registered handler. */
  readonly createInterval?: (
    handler: () => void,
    ms: number,
  ) => { clear: () => void }
}

/** Assemble injectable deps; sensible okAsync defaults, override per test. */
export function makeFakeDeps(options: FakeDepsOptions = {}): PerpSuggestionSheetDeps {
  return {
    estimateSuggestion: options.estimate ?? fakeEstimateOk(),
    executeSuggestion: options.execute ?? fakeExecuteOk(),
    getHistory: options.history ?? fakeHistoryOk(),
    getMarkets: options.markets ?? fakeMarketsOk(),
    getDelegationStatus: async () => ({
      status: (options.delegationStatus ?? 'active') as DelegationStatus,
      appSignerId: null,
      capUsd: null,
      expiresAt: null,
    }),
    openDelegationConsent: options.onGrantAccess ?? (() => undefined),
    useAgentBalance: options.useAgentBalance ?? fakeAgentBalance(),
    ...(options.now ? { now: options.now } : {}),
    ...(options.createInterval ? { createInterval: options.createInterval } : {}),
  }
}

/**
 * A controllable clock + manual ticker for the estimate-freshness tests (slice
 * 07). `advance(ms)` moves the clock; `tick()` fires every registered interval
 * handler. No real timers — assertions never depend on wall-clock.
 */
export function makeFakeClock(start = 1_000_000): {
  now: () => number
  advance: (ms: number) => void
  createInterval: (handler: () => void, ms: number) => { clear: () => void }
  tick: () => void
} {
  let current = start
  const handlers = new Set<() => void>()
  return {
    now: () => current,
    advance: (ms) => {
      current += ms
    },
    createInterval: (handler) => {
      handlers.add(handler)
      return { clear: () => handlers.delete(handler) }
    },
    tick: () => {
      for (const handler of handlers) handler()
    },
  }
}
