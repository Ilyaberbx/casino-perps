import { useCallback, useEffect, useRef, useState } from 'react'
import { usePaginatedHistory } from '@/modules/shared/hooks/use-paginated-history'
import type { PortfolioHistoryFetchError } from '@/modules/shared/domain'
import type {
  PaginatedHistoryReader,
  PaginatedHistoryReaderState,
} from './account-dock.types'

const EMPTY: ReadonlyArray<never> = []

/**
 * Drives one paginated history tab from a backward-cursor reader. Subscribes
 * for the merged list, fires the bootstrap `loadOlder()` once per subscription
 * (a `bootstrappedForRef` guard, re-armed on cleanup: the reader disposes its
 * accumulated rows on last-unsubscribe, so every fresh subscription must
 * re-bootstrap — under StrictMode's dev-only setup→cleanup→setup the second
 * setup re-fetches and the first, generation-stale response is discarded; in
 * prod exactly one bootstrap fires), tracks in-flight/exhausted/error, and
 * composes `usePaginatedHistory` for numbered client pages with auto-fetch of
 * the next window past the loaded tail (ADR-0023). The trade / order / funding
 * / interest / account-activity tabs all run through this single seam.
 *
 * `reader` is `undefined` when the venue lacks the capability — the hook stays
 * inert. The raw `error` is returned untranslated; the caller maps it to a
 * user-facing string per tab.
 *
 * `reloadKey` re-runs the one-shot bootstrap when it changes. The dock bumps it
 * each time the venue (re)connects to a wallet: the very first bootstrap can
 * fire before Privy has resolved the address (the reader's `getAddress()`
 * returns `null` → `loadOlder()` resolves `exhausted` against an empty list),
 * which is why history used to stay empty until a page switch remounted the
 * dock with the address now present.
 *
 * `accountKey` identifies *which* account the loaded rows belong to (the active
 * Spectated Address, or the connected wallet). On a (re)connect, the reload
 * branches on it: when it is unchanged, a reload only fires to recover an empty
 * bootstrap, so a user who has paged back is never reset; when it has changed
 * (a new spectated wallet), the reload always fires — `loadOlder()` rescopes the
 * underlying reader, dropping the previous account's rows and re-fetching the
 * new address from scratch. The (re)connect signal is the right trigger because
 * it lands *after* the address holder has been pointed at the new account.
 */
export function usePaginatedHistoryReader<T>(
  reader: PaginatedHistoryReader<T> | undefined,
  pageSize: number,
  reloadKey?: unknown,
  accountKey?: unknown,
): PaginatedHistoryReaderState<T> {
  const [rows, setRows] = useState<ReadonlyArray<T>>(EMPTY)
  const [isLoading, setIsLoading] = useState(false)
  const [isExhausted, setIsExhausted] = useState(false)
  const [error, setError] = useState<PortfolioHistoryFetchError | null>(null)

  const bootstrappedForRef = useRef<PaginatedHistoryReader<T> | null>(null)
  const lastReloadKeyRef = useRef(reloadKey)
  const loadedAccountRef = useRef(accountKey)
  const accountKeyRef = useRef(accountKey)
  const rowsRef = useRef<ReadonlyArray<T>>(EMPTY)
  const isLoadingRef = useRef(false)
  // A reload signalled while a load is in flight is remembered here and drained
  // once that load settles — see the reload effect and the drain effect below.
  const pendingReloadRef = useRef(false)

  const runLoadOlder = useCallback((target: PaginatedHistoryReader<T>) => {
    setIsLoading(true)
    isLoadingRef.current = true
    void target
      .loadOlder()
      .match(
        ({ exhausted }) => {
          setIsExhausted(exhausted)
          setError(null)
        },
        (loadError) => {
          setError(loadError)
        },
      )
      .finally(() => {
        isLoadingRef.current = false
        setIsLoading(false)
      })
  }, [])

  // Subscription + first bootstrap: one per subscription. Kept off the
  // `reloadKey` dependency on purpose — the reader disposes its accumulated
  // windows on last-unsubscribe, so re-running this effect on every reconnect
  // would wipe the loaded list. The guard exists for renders that keep the
  // effect alive ([reader, runLoadOlder] are stable); cleanup re-arms it
  // because our unsubscribe is the reader's last listener — the dispose drops
  // the rows and rotates the staleness generation, so the next setup MUST
  // re-bootstrap. Under StrictMode's dev-only setup→cleanup→setup the second
  // setup re-fires `loadOlder()` under the fresh generation and the first
  // (doomed) response is harmlessly discarded by the reader's staleness check.
  useEffect(() => {
    if (!reader) return
    const unsubscribe = reader.subscribe((next) => {
      rowsRef.current = next
      setRows(next)
    })
    const cleanup = () => {
      unsubscribe()
      bootstrappedForRef.current = null
    }
    const isAlreadyBootstrapped = bootstrappedForRef.current === reader
    if (isAlreadyBootstrapped) return cleanup
    bootstrappedForRef.current = reader
    loadedAccountRef.current = accountKeyRef.current
    runLoadOlder(reader)
    return cleanup
  }, [reader, runLoadOlder])

  // Mirror the latest `accountKey` into a ref (writing it during render is
  // disallowed). Declared before the reload effect so, on a connect render, this
  // runs first and the reload effect below reads the current account identity.
  useEffect(() => {
    accountKeyRef.current = accountKey
  })

  // The reload decision, factored out so both the reload effect (idle path) and
  // the drain effect (deferred path) share one rule.
  //
  // Same account: only recover an empty bootstrap — a reconnect must not reset a
  // user who has paged back. Different account (a new spectated wallet): always
  // reload, so the dock shows the new address's history instead of the previous
  // one's. `loadOlder()` itself rescopes the reader, so a genuine account switch
  // drops the old rows safely.
  const evaluateAndReload = useCallback((target: PaginatedHistoryReader<T>) => {
    const currentAccount = accountKeyRef.current
    const isAccountChanged = loadedAccountRef.current !== currentAccount
    const hasLoadedRows = rowsRef.current.length > 0
    const shouldReload = isAccountChanged || !hasLoadedRows
    if (!shouldReload) return
    loadedAccountRef.current = currentAccount
    setIsExhausted(false)
    setError(null)
    runLoadOlder(target)
  }, [runLoadOlder])

  // Reload on `reloadKey` change (the venue (re)connected to a wallet). It never
  // touches the subscription, so it cannot leak listeners.
  //
  // If a load is already in flight, DON'T drop the signal: the in-flight load
  // may be a doomed fetch against the address the venue was keyed to a moment
  // ago (e.g. the connected Primary Wallet), which the reader discards as stale
  // the instant the Viewing Address settles onto the Selected Wallet — the
  // second connect that lands mid-flight on a refresh. Remember it and let the
  // drain effect re-evaluate once the in-flight load settles, so the tab does
  // not stay empty until a page switch.
  useEffect(() => {
    const isInitialKey = lastReloadKeyRef.current === reloadKey
    lastReloadKeyRef.current = reloadKey
    if (isInitialKey || !reader) return
    if (isLoadingRef.current) {
      pendingReloadRef.current = true
      return
    }
    evaluateAndReload(reader)
  }, [reader, reloadKey, evaluateAndReload])

  // Drain a deferred reload once the in-flight load settles (`isLoading` → false).
  // A no-op unless the reload effect above parked a signal while loading.
  useEffect(() => {
    if (isLoading || !reader) return
    if (!pendingReloadRef.current) return
    pendingReloadRef.current = false
    evaluateAndReload(reader)
  }, [isLoading, reader, evaluateAndReload])

  const loadOlder = useCallback(() => {
    if (!reader || isLoading || isExhausted) return
    runLoadOlder(reader)
  }, [reader, isLoading, isExhausted, runLoadOlder])

  const pagination = usePaginatedHistory({
    rows,
    pageSize,
    loadOlder,
    isExhausted,
    isLoading,
  })

  // Prefetch-ahead: once the user has paged to the last *loaded* page and more
  // history may exist, fetch the next 30-day window in the background so the
  // following "Next" click resolves instantly instead of blocking on a REST
  // round trip — the slow-every-click feel the account-activity tab had.
  //
  // Gated to `page > 1` so it never fires on the bootstrap render: opening the
  // dock must not double the initial REST burst across every history tab
  // (ADR-0022). The `prefetchedAtRef` (keyed on the loaded row count) bounds it
  // to one prefetch per loaded-tail position, so a sparse window that returns
  // nothing cannot spin. `isLoading` in the deps re-arms it once a fetch lands.
  const prefetchedAtRef = useRef(-1)
  useEffect(() => {
    if (!reader || isLoading || isExhausted) return
    if (pagination.page <= 1) return
    if (pagination.page < pagination.pageCount) return
    if (prefetchedAtRef.current === rows.length) return
    prefetchedAtRef.current = rows.length
    runLoadOlder(reader)
  }, [
    reader,
    isLoading,
    isExhausted,
    pagination.page,
    pagination.pageCount,
    rows.length,
    runLoadOlder,
  ])

  return {
    rows,
    count: rows.length,
    pagination,
    loadOlder,
    isLoading,
    isExhausted,
    error,
  }
}
