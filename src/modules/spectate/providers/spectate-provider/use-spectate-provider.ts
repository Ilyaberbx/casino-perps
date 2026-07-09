import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseWalletAddress, type WalletAddress } from '@/modules/shared/domain'
import { toast } from '@/modules/shared/services/toast'
import { createWatchlistStore } from '../../services/watchlist-store'
import type { WatchlistEntry } from '../../services/watchlist-store'
import {
  SPECTATE_CONNECT_WALLET_MESSAGE,
  SPECTATE_QUERY_PARAM,
  WATCHLIST_STORAGE_KEY,
} from './spectate-provider.constants'
import type { SpectateContextValue, WatchlistItem } from './spectate-provider.types'

function readSpectatedAddressFromUrl(searchParams: URLSearchParams): WalletAddress | null {
  const raw = searchParams.get(SPECTATE_QUERY_PARAM)
  if (raw === null) return null
  const parsed = parseWalletAddress(raw)
  return parsed.isOk() ? parsed.value : null
}

// Re-validate each stored address so the in-memory watchlist is typed as WalletAddress.
// Malformed entries (e.g. hand-edited storage) are dropped rather than trusted blind.
function itemFromEntry(entry: WatchlistEntry): WatchlistItem | null {
  const parsed = parseWalletAddress(entry.address)
  if (parsed.isErr()) return null
  const hasLabel = entry.label !== undefined && entry.label.length > 0
  if (!hasLabel) return { address: parsed.value }
  return { address: parsed.value, label: entry.label }
}

function loadWatchlist(): WatchlistItem[] {
  const store = createWatchlistStore()
  const result = store.load(WATCHLIST_STORAGE_KEY)
  const entries = result.isOk() ? result.value.entries : []
  return entries.map(itemFromEntry).filter((item): item is WatchlistItem => item !== null)
}

function entryFromItem(item: WatchlistItem): WatchlistEntry {
  const hasLabel = item.label !== undefined && item.label.length > 0
  if (!hasLabel) return { address: item.address }
  return { address: item.address, label: item.label }
}

export function useSpectateProvider(isWalletConnected = true): SpectateContextValue {
  const [searchParams, setSearchParams] = useSearchParams()

  const store = useMemo(() => createWatchlistStore(), [])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(loadWatchlist)

  const persist = useCallback(
    (next: readonly WatchlistItem[]) => {
      store.save(WATCHLIST_STORAGE_KEY, { version: 1, entries: next.map(entryFromItem) })
    },
    [store],
  )

  const addToWatchlist = useCallback(
    (entry: WatchlistItem) => {
      setWatchlist((current) => {
        const withoutDuplicate = current.filter((item) => item.address !== entry.address)
        const next = [...withoutDuplicate, entry]
        persist(next)
        return next
      })
    },
    [persist],
  )

  const removeFromWatchlist = useCallback(
    (address: WalletAddress) => {
      setWatchlist((current) => {
        const next = current.filter((item) => item.address !== address)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const isWatchlisted = useCallback(
    (address: WalletAddress) => watchlist.some((item) => item.address === address),
    [watchlist],
  )

  // Spectating requires a connected wallet: a disconnected session must never
  // honour a `?spectate=` override, so the banner/dock/links all read inactive
  // regardless of what the URL holds. We *ignore* the param while disconnected
  // rather than stripping it — a shared link (or a reload before Privy resolves)
  // keeps the param and resumes spectating the moment the wallet connects, and
  // `useIsWalletConnected()` reads false during that resolving window, so a
  // strip here would wrongly drop a legitimate link.
  const urlSpectatedAddress = useMemo(
    () => readSpectatedAddressFromUrl(searchParams),
    [searchParams],
  )
  const spectatedAddress = isWalletConnected ? urlSpectatedAddress : null

  const clearSpectateParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(SPECTATE_QUERY_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const startSpectating = useCallback(
    (address: WalletAddress) => {
      if (!isWalletConnected) {
        toast.show({ variant: 'warning', title: SPECTATE_CONNECT_WALLET_MESSAGE })
        return
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(SPECTATE_QUERY_PARAM, address)
          return next
        },
        { replace: true },
      )
    },
    [isWalletConnected, setSearchParams],
  )

  const stopSpectating = useCallback(() => {
    clearSpectateParam()
  }, [clearSpectateParam])

  const isSpectating = spectatedAddress !== null

  return {
    spectatedAddress,
    isSpectating,
    startSpectating,
    stopSpectating,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isWatchlisted,
  }
}
