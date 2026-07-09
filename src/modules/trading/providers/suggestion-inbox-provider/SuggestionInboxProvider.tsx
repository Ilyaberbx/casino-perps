import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/modules/shared/services/toast'
import { logger } from '@/app/logger'
import { requestIdFrom } from '@/modules/shared/http'
import {
  createSuggestionAckStore,
  type SuggestionAckStore,
} from '../../services/suggestion-ack-store'
import { SuggestionInboxContext } from './suggestion-inbox-provider.context'
import { INBOX_POLL_INTERVAL_MS } from './suggestion-inbox-provider.constants'
import {
  hasPending,
  mapFailureReason,
  selectPendingToasts,
} from './suggestion-inbox-provider.utils'
import type {
  SuggestionInboxContextValue,
  SuggestionInboxProviderProps,
} from './suggestion-inbox-provider.types'

const log = logger.child({ module: 'suggestion-inbox' })

/**
 * The app-level inbox controller (ADR-0073 D-5). Mounted inside auth so it has
 * the apiClient + Privy identity; survives sheet-close and reload. It discovers
 * in-flight work on boot via one `/inbox` fetch, polls every ~4s ONLY while ≥1
 * row is pending (plus on window focus), and fires a toast exactly once when a
 * watched id resolves — using a localStorage ack-set so a reload doesn't
 * re-toast already-seen outcomes while outcomes resolved-while-away still toast
 * on return. A completion bumps `historyDirtyVersion` so an open History tab
 * refetches. Reaches the server only through `trading/api/get-suggestion-inbox`.
 */
export function SuggestionInboxProvider({
  children,
  enabled,
  getInbox,
  createInterval,
}: SuggestionInboxProviderProps) {
  const [historyDirtyVersion, setHistoryDirtyVersion] = useState(0)
  // Watched ids (this session) + the ack store live in refs so `watch` and the
  // focus listener don't re-create the polling effect on every call. `enabled`
  // is mirrored into a ref so the stable `reconcile` callback reads it without
  // taking it as a dependency (which would re-identify the callback).
  const watchedRef = useRef<Set<string>>(new Set())
  const ackStoreRef = useRef<SuggestionAckStore>(createSuggestionAckStore())
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])
  // Boot discovery seeds polling; afterwards it continues only while pending.
  const [shouldPoll, setShouldPoll] = useState(false)

  const makeInterval = useMemo(
    () =>
      createInterval ??
      ((handler: () => void, ms: number) => {
        const id = setInterval(handler, ms)
        return { clear: () => clearInterval(id) }
      }),
    [createInterval],
  )

  // One fetch + diff against the watched/acked sets. Stable identity (deps are
  // only the injected reader) so effects don't churn; the setStates all run in
  // the async resolution, never synchronously in an effect body. The server
  // inbox is the source of truth — we only reconcile it.
  const reconcile = useCallback(() => {
    if (!enabledRef.current) return
    getInbox().match(
      (items) => {
        const watched = watchedRef.current
        const acked = new Set(ackStoreRef.current.load())
        const toasts = selectPendingToasts(items, watched, acked)
        let didComplete = false
        for (const pending of toasts) {
          ackStoreRef.current.ack(pending.id, Date.now())
          if (pending.status === 'completed') {
            didComplete = true
            toast.show({
              variant: 'success',
              title: 'Suggestion ready',
              description: pending.symbol,
            })
            continue
          }
          toast.show({
            variant: 'error',
            title: 'Suggestion failed',
            description: mapFailureReason(pending.failureReason),
          })
        }
        if (didComplete) setHistoryDirtyVersion((version) => version + 1)
        // Keep polling only while something is still in flight.
        setShouldPoll(hasPending(items))
      },
      (error) => {
        const requestId = requestIdFrom(error)
        log.warn(
          { kind: error.kind, ...(requestId ? { requestId } : {}) },
          'inbox fetch failed',
        )
      },
    )
  }, [getInbox])

  const watch = useCallback(
    (suggestionId: string) => {
      watchedRef.current.add(suggestionId)
      // A freshly-watched id is in flight — resume polling and fetch now.
      setShouldPoll(true)
      reconcile()
    },
    [reconcile],
  )

  // Boot discovery: one fetch when the provider becomes enabled, to reconcile
  // work that resolved (or is still pending) from a previous session. The fetch
  // is async, so its setStates land in the resolution callback, not here.
  useEffect(() => {
    if (!enabled) return
    reconcile()
  }, [enabled, reconcile])

  // Poll every ~4s ONLY while pending work exists — a stopped poll costs nothing.
  useEffect(() => {
    const shouldRun = enabled && shouldPoll
    if (!shouldRun) return
    const handle = makeInterval(() => reconcile(), INBOX_POLL_INTERVAL_MS)
    return () => handle.clear()
  }, [enabled, shouldPoll, makeInterval, reconcile])

  // Refetch on window focus so a return-to-tab reconciles immediately rather than
  // waiting for the next poll tick (and resolves outcomes when polling is idle).
  useEffect(() => {
    if (!enabled) return
    const onFocus = () => reconcile()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, reconcile])

  const value = useMemo<SuggestionInboxContextValue>(
    () => ({ watch, historyDirtyVersion }),
    [watch, historyDirtyVersion],
  )

  return (
    <SuggestionInboxContext.Provider value={value}>
      {children}
    </SuggestionInboxContext.Provider>
  )
}
