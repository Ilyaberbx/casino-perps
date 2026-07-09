import { useCallback, useEffect, useRef, useState } from 'react'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { useSpectate } from '@/modules/spectate'
import { toast } from '@/modules/shared/services/toast'
import type { ActiveTwap, ConnectionStatus } from '@/modules/shared/domain'
import { DOCK_HISTORY_PAGE_SIZE } from './account-dock.constants'
import { historyErrorMessage } from './account-dock.utils'
import { usePaginatedHistoryReader } from './use-paginated-history-reader'
import {
  buildTwapBulkCancelToast,
  buildTwapCancelErrorToast,
  buildTwapCancelledToast,
} from './twap-cancel-toast.utils'
import { DEFAULT_TWAP_SUB_TAB, TWAP_TICK_INTERVAL_MS } from './twap-panel.constants'
import type { TwapSubTab, UseTwapPanelReturn } from './twap-panel.types'

const EMPTY_TWAPS: ReadonlyArray<ActiveTwap> = []

export function useTwapPanel(reloadKey?: string | null): UseTwapPanelReturn {
  const venue = useVenue()
  const isMobile = useIsMobile()
  const { isSpectating } = useSpectate()
  const twapActiveCap = venue.capabilities.twapActiveSnapshot
  const twapControllerCap = venue.capabilities.twapController
  const twapHistoryCap = venue.capabilities.twapHistory
  const twapSliceFillsCap = venue.capabilities.twapSliceFills
  const connectionCap = venue.capabilities.connection

  // While spectating, write affordances (per-row + bulk Cancel) are hidden — the
  // dock is preview-only — mirroring use-account-dock's `canAct` gate.
  const canAct = !isSpectating
  const hasTwapController = twapControllerCap !== undefined && canAct
  const hasTwap = twapActiveCap !== undefined
  const hasTwapHistory = twapHistoryCap !== undefined
  const hasFillHistory = twapSliceFillsCap !== undefined

  const [subTab, setSubTab] = useState<TwapSubTab>(DEFAULT_TWAP_SUB_TAB)
  const [now, setNow] = useState(() => Date.now())
  const [activeTwaps, setActiveTwaps] = useState<ReadonlyArray<ActiveTwap>>(EMPTY_TWAPS)
  const [twapsLoaded, setTwapsLoaded] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const prevConnectionRef = useRef<ConnectionStatus | null>(null)
  const prevReloadKeyRef = useRef(reloadKey)

  // 1s tick: re-derive `now` so each Active row's Time Remaining countdown ticks
  // without the dumb row reading the clock. Cleared on unmount.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TWAP_TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // Drop the previous account's snapshot + selection on an account switch so a
  // new spectated wallet shows a fresh panel (mirrors use-account-dock).
  useEffect(() => {
    const keyChanged = prevReloadKeyRef.current !== reloadKey
    prevReloadKeyRef.current = reloadKey
    if (!keyChanged) return
    setActiveTwaps(EMPTY_TWAPS)
    setTwapsLoaded(false)
    setSelectedIds(new Set())
  }, [reloadKey])

  // Re-bootstrap the paginated history tabs on each fresh connect (the address
  // is live by then) — same trigger use-account-dock uses for its history tabs.
  useEffect(() => {
    return connectionCap.subscribe((status) => {
      const wasConnected = prevConnectionRef.current === 'connected'
      prevConnectionRef.current = status
      const becameConnected = status === 'connected' && !wasConnected
      if (becameConnected) setReloadNonce((nonce) => nonce + 1)
    })
  }, [connectionCap])

  useEffect(() => {
    if (!twapActiveCap) return
    return twapActiveCap.subscribe((next) => {
      setActiveTwaps(next)
      setTwapsLoaded(true)
    })
  }, [twapActiveCap])

  const historyReader = usePaginatedHistoryReader(
    twapHistoryCap,
    DOCK_HISTORY_PAGE_SIZE,
    reloadNonce,
    reloadKey,
  )
  const fillHistoryReader = usePaginatedHistoryReader(
    twapSliceFillsCap,
    DOCK_HISTORY_PAGE_SIZE,
    reloadNonce,
    reloadKey,
  )

  const toggleSelected = useCallback((identifier: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(identifier)) next.delete(identifier)
      else next.add(identifier)
      return next
    })
  }, [])

  const cancelTwap = useCallback(
    (twap: ActiveTwap) => {
      if (!twapControllerCap) return
      twapControllerCap.cancelTwap(twap).match(
        () => toast.show(buildTwapCancelledToast(twap.symbol)),
        (error) => toast.show(buildTwapCancelErrorToast(error)),
      )
    },
    [twapControllerCap],
  )

  const requestBulkCancel = useCallback(() => {
    if (!twapControllerCap) return
    if (selectedIds.size === 0) return
    setIsBulkConfirmOpen(true)
  }, [twapControllerCap, selectedIds])

  const dismissBulkCancel = useCallback(() => {
    setIsBulkConfirmOpen(false)
  }, [])

  const confirmBulkCancel = useCallback(() => {
    setIsBulkConfirmOpen(false)
    if (!twapControllerCap) return
    const selected = activeTwaps.filter((twap) => selectedIds.has(twap.identifier))
    if (selected.length === 0) return
    twapControllerCap.cancelAll(selected).match(
      (failures) => {
        toast.show(buildTwapBulkCancelToast(selected.length, failures.length))
        setSelectedIds(new Set())
      },
      // cancelAll never errs (errors are collected into the ok value), but the
      // neverthrow type requires a handler — keep it total.
      () => undefined,
    )
  }, [twapControllerCap, activeTwaps, selectedIds])

  const historyError =
    historyReader.error === null ? null : historyErrorMessage(historyReader.error, 'TWAP history')
  const fillHistoryError =
    fillHistoryReader.error === null
      ? null
      : historyErrorMessage(fillHistoryReader.error, 'TWAP fill history')

  return {
    subTab,
    setSubTab,
    now,
    activeTwaps,
    areTwapsLoading: hasTwap && !twapsLoaded,
    hasTwapController,
    selectedIds,
    toggleSelected,
    selectedCount: selectedIds.size,
    cancelTwap,
    requestBulkCancel,
    isBulkConfirmOpen,
    confirmBulkCancel,
    dismissBulkCancel,
    hasTwapHistory,
    twapHistory: historyReader.rows,
    historyPagination: historyReader.pagination,
    historyCount: historyReader.count,
    isHistoryLoading: historyReader.isLoading,
    historyError,
    hasFillHistory,
    fillHistory: fillHistoryReader.rows,
    fillHistoryPagination: fillHistoryReader.pagination,
    fillHistoryCount: fillHistoryReader.count,
    isFillHistoryLoading: fillHistoryReader.isLoading,
    fillHistoryError,
    isMobile,
  }
}
