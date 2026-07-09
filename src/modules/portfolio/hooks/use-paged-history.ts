import { useCallback, useEffect, useState } from 'react'
import { useAuth, useIsWalletConnected } from '@/modules/account'
import type { PortfolioHistoryFetchError } from '@/modules/shared/domain'
import type { PagedHistoryReader, UsePagedHistoryReturn } from './use-paged-history.types'

/**
 * Owns the subscribe + loadOlder + exhausted/error/loadingMore lifecycle shared
 * by every Portfolio history tab. Collapses five near-identical panel hooks into
 * one seam. The caller supplies the narrowed reader (or `undefined` when the
 * venue lacks the capability — the hook stays inert).
 *
 * Re-subscribes on wallet-address rotation (history is address-bound) and gates
 * on connection. `loadOlder` is idempotent while a fetch is in flight.
 */
export function usePagedHistory<T>(
  cap: PagedHistoryReader<T> | undefined,
): UsePagedHistoryReturn<T> {
  const isConnected = useIsWalletConnected()
  const { walletAddress } = useAuth()
  const [entries, setEntries] = useState<ReadonlyArray<T>>([])
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<PortfolioHistoryFetchError | null>(null)
  const [loadingMore, setLoadingMore] = useState(true)

  useEffect(() => {
    if (!isConnected) return
    if (!cap) return
    const unsubscribe = cap.subscribe((next) => setEntries(next))
    void cap.loadOlder().then((result) => {
      setLoadingMore(false)
      if (result.isErr()) {
        setError(result.error)
        setExhausted(false)
        return
      }
      setError(null)
      setExhausted(result.value.exhausted)
    })
    return unsubscribe
  }, [cap, isConnected, walletAddress])

  const loadOlder = useCallback(() => {
    if (!cap) return
    if (loadingMore) return
    setLoadingMore(true)
    setError(null)
    void cap.loadOlder().then((result) => {
      setLoadingMore(false)
      if (result.isErr()) {
        setError(result.error)
        return
      }
      setExhausted(result.value.exhausted)
    })
  }, [cap, loadingMore])

  return { entries, exhausted, error, loadingMore, loadOlder }
}
