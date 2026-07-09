import { okAsync, ResultAsync } from 'neverthrow'
import type {
  PortfolioHistoryFetchError,
  Unsubscribe,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type {
  HyperliquidGatewayError,
  HyperliquidTimeWindow,
} from '../gateway/hyperliquid-gateway.types'
import { mapGatewayHistoryError } from './map-gateway-history-error'

/**
 * Per-call record-cap floor for Hyperliquid time-range info responses. The docs
 * state 500; live `userNonFundingLedgerUpdates` / `userFillsByTime` responses
 * return up to ~2000. We page until a response comes back SHORTER than this
 * floor (so it is definitely un-truncated) or stops advancing — making the loop
 * robust to either real cap without hard-coding a single number. See ADR-0034.
 */
export const PAGE_CAP_FLOOR = 500

/**
 * Maximum number of time-pages a single full-history load will fetch. A
 * rate-limit backstop for pathological accounts (vaults / bridges with tens of
 * thousands of ledger rows). At ~weight-20/call this bounds one tab's burst to
 * `budget × 20` against HL's 1200 weight/min IP budget. Sub-budget wallets load
 * their complete history; only mega-accounts are capped (and then show the
 * oldest `budget × cap` rows, matching the reference frontend's own limit).
 */
export const PAGED_HISTORY_BUDGET = 10

/**
 * Native time order of the underlying fetch:
 * - `ascending`  — the endpoint returns oldest-first and ignores `reversed`
 *   (`userNonFundingLedgerUpdates`, `userFunding`, `userBorrowLendInterest`).
 *   One `loadOlder()` forward-pages the FULL history from epoch, then the reader
 *   exposes it **newest-first** (client sort). Subsequent calls are no-ops.
 * - `descending` — the endpoint returns newest-first (`userFillsByTime` with
 *   `reversed: true`). `loadOlder()` pages the next-older window by an `endTime`
 *   cursor, so deep history stays reachable through the numbered-pagination tail.
 */
export type HistoryOrder = 'ascending' | 'descending'

export interface CreatePagedHistoryReaderDeps<TItem, TResponse> {
  readonly getAddress: () => WalletAddress | null
  readonly logger: Logger
  /** Bound under `module:` on every record from this reader. */
  readonly logModule: string
  readonly fetch: (
    address: WalletAddress,
    window: HyperliquidTimeWindow,
  ) => ResultAsync<TResponse, HyperliquidGatewayError>
  readonly project: (response: TResponse) => ReadonlyArray<TItem>
  /** Epoch-ms timestamp of an item — drives newest-first ordering and paging. */
  readonly getTime: (item: TItem) => number
  /** Stable identity for dedupe across page boundaries and reconnect overlap. */
  readonly getKey: (item: TItem) => string
  readonly order: HistoryOrder
  /** Override for tests; defaults to `Date.now`. */
  readonly now?: () => number
  /** Override for tests; defaults to `PAGED_HISTORY_BUDGET`. */
  readonly budget?: number
  /** Override for tests; defaults to `PAGE_CAP_FLOOR`. */
  readonly pageCapFloor?: number
}

export interface PagedHistoryReader<TItem> {
  subscribe(onUpdate: (items: ReadonlyArray<TItem>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}

/**
 * Canonical Portfolio/dock history reader (ADR-0034, supersedes the 30-day
 * backward-window scan of ADR-0023 §d). The Hyperliquid history endpoints
 * return rows **oldest-first** and cap each call; the reference frontend
 * (trade.xyz) fetches one wide `startTime:0` window and sorts client-side. This
 * reader does the same, always exposing rows **newest-first**:
 *
 * - `ascending` order: one `loadOlder()` forward-pages the full history from
 *   epoch (bounded by `budget`), de-duping by `getKey` across the cap boundary,
 *   then sorts by `getTime` descending. For the common case this is one fetch.
 * - `descending` order: each `loadOlder()` fetches the next-older window via an
 *   `endTime` cursor (the source is already newest-first), appending older rows.
 *
 * Reused by `tradeHistory` (descending), `fundingHistory`, `interestHistory`,
 * and `accountActivity` (ascending).
 */
export function createPagedHistoryReader<TItem, TResponse>(
  deps: CreatePagedHistoryReaderDeps<TItem, TResponse>,
): PagedHistoryReader<TItem> {
  const log = deps.logger.child({ module: deps.logModule })
  log.debug({}, 'init')
  const now = deps.now ?? (() => Date.now())
  const budget = deps.budget ?? PAGED_HISTORY_BUDGET
  const capFloor = deps.pageCapFloor ?? PAGE_CAP_FLOOR

  const listeners = new Set<(items: ReadonlyArray<TItem>) => void>()
  // Accumulated rows keyed for dedupe; always emitted sorted newest-first.
  const byKey = new Map<string, TItem>()
  let items: ReadonlyArray<TItem> = []
  let scoped: WalletAddress | null = null
  let exhausted = false
  // `descending` mode only: the `endTime` cursor for the next-older page
  // (null ⇒ start at `now`).
  let nextEndTime: number | null = null
  // Bumped on rescope (address change) and on dispose (last unsubscribe).
  // Captured at fetch start so an in-flight response landing after the scope
  // moved on is discarded rather than merged.
  let generation = 0

  function notify(): void {
    for (const l of listeners) l(items)
  }

  function rebuildAndNotify(): void {
    items = [...byKey.values()].sort((a, b) => deps.getTime(b) - deps.getTime(a))
    notify()
  }

  function rescope(next: WalletAddress | null): void {
    if (next === scoped) return
    scoped = next
    exhausted = false
    nextEndTime = null
    generation += 1
    if (byKey.size > 0) {
      byKey.clear()
      items = []
      notify()
    }
  }

  // A response that lands after the scope it was issued under has moved on
  // (address rotated, listener disposed/resubscribed, scope diverged mid-flight)
  // must be dropped rather than committed against the new scope.
  function isStale(requested: WalletAddress, requestedGeneration: number): boolean {
    const generationRotated = generation !== requestedGeneration
    const scopeDiverged = scoped !== requested
    const addressChanged = deps.getAddress() !== requested
    return generationRotated || scopeDiverged || addressChanged
  }

  function merge(rows: ReadonlyArray<TItem>): number {
    let added = 0
    for (const row of rows) {
      const key = deps.getKey(row)
      if (!byKey.has(key)) added += 1
      byKey.set(key, row)
    }
    return added
  }

  function fetchRows(
    requested: WalletAddress,
    window: HyperliquidTimeWindow,
  ): ResultAsync<ReadonlyArray<TItem>, PortfolioHistoryFetchError> {
    return deps
      .fetch(requested, window)
      .mapErr((err) => {
        const mapped = mapGatewayHistoryError(err)
        log.warn(
          { kind: mapped.kind, errorMessage: err.message, startTime: window.startTime, endTime: window.endTime },
          'fetch failed',
        )
        return mapped
      })
      .map((response) => deps.project(response))
  }

  function maxTime(rows: ReadonlyArray<TItem>, fallback: number): number {
    return rows.reduce((max, row) => Math.max(max, deps.getTime(row)), fallback)
  }

  function minTime(rows: ReadonlyArray<TItem>, fallback: number): number {
    return rows.reduce((min, row) => Math.min(min, deps.getTime(row)), fallback)
  }

  // ascending: forward-page the full history from epoch, then expose it
  // newest-first. One `loadOlder()` runs the whole loop; the reader exhausts
  // when a page is short (un-truncated), stops advancing, or the budget is hit.
  function loadAscending(
    requested: WalletAddress,
    requestedGeneration: number,
  ): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError> {
    const step = (
      startTime: number,
      prevMax: number,
      pages: number,
    ): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError> => {
      return fetchRows(requested, { startTime, endTime: now() }).andThen((rows) => {
        if (isStale(requested, requestedGeneration)) return okAsync({ exhausted: false })
        merge(rows)
        const max = maxTime(rows, prevMax)
        const isDrained = rows.length === 0
        const isShortPage = rows.length < capFloor
        const madeNoProgress = max <= prevMax
        const isBudgetHit = pages + 1 >= budget
        const reachedEnd = isDrained || isShortPage || madeNoProgress || isBudgetHit
        if (!reachedEnd) return step(max, max, pages + 1)
        exhausted = true
        rebuildAndNotify()
        return okAsync({ exhausted: true })
      })
    }
    return step(0, -1, 0)
  }

  // descending: each call pages the next-older window. The source is already
  // newest-first; we advance an `endTime` cursor to just past the oldest row
  // loaded so far and re-include the boundary (dedupe handles the overlap).
  function loadDescending(
    requested: WalletAddress,
    requestedGeneration: number,
  ): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError> {
    const endTime = nextEndTime ?? now()
    return fetchRows(requested, { startTime: 0, endTime }).andThen((rows) => {
      if (isStale(requested, requestedGeneration)) return okAsync({ exhausted: false })
      const added = merge(rows)
      nextEndTime = rows.length > 0 ? minTime(rows, endTime) : endTime
      const isShortPage = rows.length < capFloor
      const addedNothing = added === 0
      const reachedStart = isShortPage || addedNothing
      if (reachedStart) exhausted = true
      rebuildAndNotify()
      return okAsync({ exhausted })
    })
  }

  function dispose(): void {
    byKey.clear()
    items = []
    scoped = null
    nextEndTime = null
    exhausted = false
    generation += 1
  }

  return {
    subscribe(onUpdate): Unsubscribe {
      listeners.add(onUpdate)
      onUpdate(items)
      return () => {
        listeners.delete(onUpdate)
        if (listeners.size === 0) dispose()
      }
    },
    loadOlder() {
      const address = deps.getAddress()
      rescope(address)
      if (address === null) return okAsync({ exhausted: true })
      if (exhausted) return okAsync({ exhausted: true })
      const isDescending = deps.order === 'descending'
      if (isDescending) return loadDescending(address, generation)
      return loadAscending(address, generation)
    },
  }
}
