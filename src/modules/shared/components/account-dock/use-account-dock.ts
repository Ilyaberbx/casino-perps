import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { useSpectate } from '@/modules/spectate'
import { OnboardingFlowContext } from '@/modules/account'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { toast } from '@/modules/shared/services/toast'
import { ORDER_CLOID_PREFIX } from '@/modules/shared/constants/order.constants'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { fromPositionSnapshot, fromClosedFill } from '@/modules/shared/components/pnl-card'
import type { PnlCardContext, PnlCardView } from '@/modules/shared/components/pnl-card'
import type {
  Order,
  Fill,
  PerpPositionSnapshot,
  ActiveTwap,
  ConnectionStatus,
  PlaceOrderRequest,
  PositionProtectionLegs,
  ModifyOrderRequest,
} from '@/modules/shared/domain'
import type {
  BulkActionKind,
  DockTab,
  PositionRowView,
  UseAccountDockReturn,
} from './account-dock.types'
import { DEFAULT_TAB, DOCK_HISTORY_PAGE_SIZE } from './account-dock.constants'
import { historyErrorMessage, derivePositionTpsl } from './account-dock.utils'
import { usePaginatedHistoryReader } from './use-paginated-history-reader'
import { buildMarketCloseRequest } from './close-position.utils'
import {
  buildClosePendingToast,
  buildCloseOutcomeToast,
  buildCloseErrorToast,
} from './close-position-toast.utils'
import {
  buildProtectionAppliedToast,
  buildProtectionClearedToast,
  buildProtectionErrorToast,
} from './position-protection-toast.utils'
import {
  buildModifyAppliedToast,
  buildModifyErrorToast,
} from './modify-order-toast.utils'

const EMPTY_POSITIONS: ReadonlyArray<PerpPositionSnapshot> = []
const EMPTY_ORDERS: ReadonlyArray<Order> = []
const EMPTY_TWAPS: ReadonlyArray<ActiveTwap> = []

export function useAccountDock(reloadKey?: string | null): UseAccountDockReturn {
  const venue = useVenue()
  const isMobile = useIsMobile()
  const { isSpectating } = useSpectate()
  // Read the onboarding context directly (not via `useOnboardingFlow`, which
  // calls `useAuth` and throws without the provider) so the dock — and its
  // isolated tests — stay provider-free; the handle is null when absent.
  const onboarding = useContext(OnboardingFlowContext)
  const handle = onboarding?.kind === 'ready' ? onboarding.me.user.handle : null
  // Identity + venue stamped onto every shared PnL card: the sharer's @handle
  // (bottom-right) and the DEX badge. The traded `market` (for the real asset
  // icon) is resolved per-share by symbol, so it's added at share time.
  const shareContext = useMemo<Omit<PnlCardContext, 'market'>>(
    () => ({ handle, venueId: venue.metadata.id, venueLabel: venue.metadata.label }),
    [handle, venue],
  )
  // Positions and fills carry the bare venue coin (`ap.position.coin` → `BTC`,
  // HIP-3 `xyz:NVDA`), which is the market's `hlCoin` — NOT its display `symbol`
  // (`BTC-PERP`). Match `hlCoin` first (the identity the snapshot actually
  // holds), then fall back to `symbol` for venues that key markets by symbol
  // (mock-venue sets `hlCoin === symbol`). Matching only `symbol` left every
  // real Hyperliquid share with a null market → letter fallback, no real icon.
  const resolveShareMarket = useCallback(
    (symbol: string) =>
      venue.capabilities.marketData
        ?.listMarkets()
        .find((m) => m.hlCoin === symbol || m.symbol === symbol) ?? null,
    [venue],
  )
  const positionsCap = venue.capabilities.perpsPositionsSnapshot
  const openOrdersCap = venue.capabilities.openOrdersSnapshot
  const tradeHistoryCap = venue.capabilities.tradeHistory
  const orderHistoryCap = venue.capabilities.orderHistory
  const fundingHistoryCap = venue.capabilities.fundingHistory
  const interestHistoryCap = venue.capabilities.interestHistory
  const accountActivityCap = venue.capabilities.accountActivity
  const twapActiveCap = venue.capabilities.twapActiveSnapshot
  const traderCap = venue.capabilities.trader
  const positionProtectionCap = venue.capabilities.positionProtection

  const hasPositions = positionsCap !== undefined
  const hasOpenOrders = openOrdersCap !== undefined
  const hasTradeHistory = tradeHistoryCap !== undefined
  const hasOrderHistory = orderHistoryCap !== undefined
  const hasFundingHistory = fundingHistoryCap !== undefined
  const hasInterestHistory = interestHistoryCap !== undefined
  const hasAccountActivity = accountActivityCap !== undefined
  const hasTwap = twapActiveCap !== undefined
  // Spectating lockout: while spectating, every row action + bulk affordance is
  // hidden (the form is preview-only via OrderEntry's own swap). The action
  // affordances all gate on these flags, so suppressing them here removes
  // Close / Cancel / Modify / TP-SL / Close-all / Cancel-all in one place —
  // without touching the live data subscriptions.
  const canAct = !isSpectating
  const hasTrader = traderCap !== undefined && canAct
  const hasModifyOrder = traderCap?.modifyOrder !== undefined && canAct
  const hasPositionProtection = positionProtectionCap !== undefined && canAct

  const connectionCap = venue.capabilities.connection

  const [activeTab, setActiveTab] = useState<DockTab>(DEFAULT_TAB)
  const [positions, setPositions] = useState<ReadonlyArray<PerpPositionSnapshot>>(EMPTY_POSITIONS)
  const [orders, setOrders] = useState<ReadonlyArray<Order>>(EMPTY_ORDERS)
  const [activeTwaps, setActiveTwaps] = useState<ReadonlyArray<ActiveTwap>>(EMPTY_TWAPS)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [managedPosition, setManagedPosition] = useState<PerpPositionSnapshot | null>(null)
  const [protectionPosition, setProtectionPosition] = useState<PerpPositionSnapshot | null>(null)
  const [modifiedOrder, setModifiedOrder] = useState<Order | null>(null)
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkActionKind | null>(null)
  const [shareView, setShareView] = useState<PnlCardView | null>(null)
  // First-emission readiness (ADR-0036): each snapshot cap pushes its complete
  // array on first emission, so receipt of that emission is the loaded signal.
  // Reset on `reloadKey` (account switch) so the skeleton shows again while the
  // new account's first snapshot is in flight.
  const [positionsLoaded, setPositionsLoaded] = useState(false)
  const [openOrdersLoaded, setOpenOrdersLoaded] = useState(false)
  const [twapsLoaded, setTwapsLoaded] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const prevConnectionRef = useRef<ConnectionStatus | null>(null)
  const prevReloadKeyRef = useRef(reloadKey)

  // Switching the spectated account drops the previous account's live snapshots
  // so they don't linger until the re-keyed stream's next tick lands. The
  // paginated history tabs reload on the connect that follows the address swap —
  // see `usePaginatedHistoryReader`, which reloads on `reloadNonce` and resets
  // on `reloadKey` (the account identity). The connect is the correct trigger:
  // it fires only after the address holder has been pointed at the new account.
  useEffect(() => {
    const keyChanged = prevReloadKeyRef.current !== reloadKey
    prevReloadKeyRef.current = reloadKey
    if (!keyChanged) return
    setPositions(EMPTY_POSITIONS)
    setOrders(EMPTY_ORDERS)
    setActiveTwaps(EMPTY_TWAPS)
    setPositionsLoaded(false)
    setOpenOrdersLoaded(false)
    setTwapsLoaded(false)
  }, [reloadKey])

  // The paged history readers bootstrap once on mount. When that happens before
  // Privy resolves the wallet address, the bootstrap loads against a null
  // address and the tab stays empty until a page switch remounts the dock. The
  // venue reaching `connected` is the address-bound "account data is live"
  // signal, fired after the address holder is updated — bumping `reloadNonce`
  // on each fresh connect re-runs the bootstrap with the address now present.
  useEffect(() => {
    return connectionCap.subscribe((status) => {
      const wasConnected = prevConnectionRef.current === 'connected'
      prevConnectionRef.current = status
      const becameConnected = status === 'connected' && !wasConnected
      if (becameConnected) setReloadNonce((nonce) => nonce + 1)
    })
  }, [connectionCap])

  // Snapshot caps push the full array each tick — straight subscribe, no paging.
  useEffect(() => {
    if (!positionsCap) return
    return positionsCap.subscribe((next) => {
      setPositions(next)
      setPositionsLoaded(true)
    })
  }, [positionsCap])

  useEffect(() => {
    if (!openOrdersCap) return
    return openOrdersCap.subscribe((next) => {
      setOrders(next)
      setOpenOrdersLoaded(true)
    })
  }, [openOrdersCap])

  useEffect(() => {
    if (!twapActiveCap) return
    return twapActiveCap.subscribe((next) => {
      setActiveTwaps(next)
      setTwapsLoaded(true)
    })
  }, [twapActiveCap])

  // Every paginated history tab runs through one seam: subscribe + bootstrap
  // loadOlder once + numbered pagination. Trade history auto-fetches the next
  // 30-day window past the loaded tail; the one-shot readers (order history,
  // twap history) exhaust on first load so paging stays client-side.
  const fillsReader = usePaginatedHistoryReader(tradeHistoryCap, DOCK_HISTORY_PAGE_SIZE, reloadNonce, reloadKey)
  const ordersReader = usePaginatedHistoryReader(orderHistoryCap, DOCK_HISTORY_PAGE_SIZE, reloadNonce, reloadKey)
  const fundingReader = usePaginatedHistoryReader(fundingHistoryCap, DOCK_HISTORY_PAGE_SIZE, reloadNonce, reloadKey)
  const interestReader = usePaginatedHistoryReader(interestHistoryCap, DOCK_HISTORY_PAGE_SIZE, reloadNonce, reloadKey)
  const activityReader = usePaginatedHistoryReader(accountActivityCap, DOCK_HISTORY_PAGE_SIZE, reloadNonce, reloadKey)

  // Close = a reduce-only `placeOrder` (no separate port). `submitClose` owns
  // the toast lifecycle (pending → outcome/rejection, keyed by cloid); the
  // ClosePositionDialog builds the request (partial / limit). The stream
  // reconciles the position — no optimistic table mutation.
  const submitClose = useCallback(
    (request: PlaceOrderRequest) => {
      if (!traderCap) return
      // Capture the pre-close snapshot now: the stream reconciles the position
      // away on a fill, so a "Share result" clicked from the success toast must
      // already hold the figures. The card is labelled `Realized`.
      const sharePosition = positions.find((entry) => entry.symbol === request.symbol) ?? null
      const clientOrderId = request.clientOrderId ?? generateCloid(ORDER_CLOID_PREFIX)
      toast.show(buildClosePendingToast(clientOrderId, request.symbol))
      traderCap.placeOrder({ ...request, clientOrderId }).match(
        (outcome) => {
          const base = buildCloseOutcomeToast(clientOrderId, request.symbol, outcome)
          const didFill = outcome.kind !== 'resting'
          const canShareResult = didFill && sharePosition !== null && canAct
          const payload = canShareResult
            ? {
                ...base,
                action: {
                  label: 'Share PnL',
                  onClick: () =>
                    setShareView(
                      fromPositionSnapshot(sharePosition, {
                        realized: true,
                        ...shareContext,
                        market: resolveShareMarket(sharePosition.symbol),
                      }),
                    ),
                },
              }
            : base
          toast.show(payload)
        },
        (error) => {
          toast.show(buildCloseErrorToast(clientOrderId, error))
        },
      )
    },
    [traderCap, positions, canAct, shareContext, resolveShareMarket],
  )

  // Inline one-tap Close: full reduce-only market close of the position.
  const closePosition = useCallback(
    (symbol: string) => {
      const position = positions.find((entry) => entry.symbol === symbol)
      if (position === undefined) return
      const request = buildMarketCloseRequest({
        position,
        size: Math.abs(position.size),
        clientOrderId: generateCloid(ORDER_CLOID_PREFIX),
      })
      submitClose(request)
    },
    [positions, submitClose],
  )

  const openManage = useCallback((position: PerpPositionSnapshot) => {
    setManagedPosition(position)
  }, [])

  const closeManage = useCallback(() => {
    setManagedPosition(null)
  }, [])

  const openProtection = useCallback((position: PerpPositionSnapshot) => {
    setProtectionPosition(position)
  }, [])

  const closeProtection = useCallback(() => {
    setProtectionPosition(null)
  }, [])

  const submitProtection = useCallback(
    (symbol: string, legs: PositionProtectionLegs) => {
      if (!positionProtectionCap) return
      positionProtectionCap.setProtection(symbol, legs).match(
        () => toast.show(buildProtectionAppliedToast(symbol)),
        (error) => toast.show(buildProtectionErrorToast(error)),
      )
    },
    [positionProtectionCap],
  )

  const clearProtection = useCallback(
    (symbol: string) => {
      if (!positionProtectionCap) return
      positionProtectionCap.clearProtection(symbol).match(
        () => toast.show(buildProtectionClearedToast(symbol)),
        (error) => toast.show(buildProtectionErrorToast(error)),
      )
    },
    [positionProtectionCap],
  )

  const onSharePosition = useCallback(
    (position: PerpPositionSnapshot) => {
      setShareView(
        fromPositionSnapshot(position, {
          ...shareContext,
          market: resolveShareMarket(position.symbol),
        }),
      )
    },
    [shareContext, resolveShareMarket],
  )

  const onShareFill = useCallback(
    (fill: Fill) => {
      setShareView(
        fromClosedFill(fill, { ...shareContext, market: resolveShareMarket(fill.symbol) }),
      )
    },
    [shareContext, resolveShareMarket],
  )

  const closeShare = useCallback(() => {
    setShareView(null)
  }, [])

  const openModify = useCallback((order: Order) => {
    setModifiedOrder(order)
  }, [])

  const closeModify = useCallback(() => {
    setModifiedOrder(null)
  }, [])

  const submitModify = useCallback(
    (request: ModifyOrderRequest, symbol: string) => {
      const modify = traderCap?.modifyOrder
      if (modify === undefined) return
      modify(request).match(
        () => toast.show(buildModifyAppliedToast(symbol)),
        (error) => toast.show(buildModifyErrorToast(error)),
      )
    },
    [traderCap],
  )

  const cancelOrder = useCallback(
    (identifier: string) => {
      if (!traderCap) {
        setCancelError('Order cancellation is not supported by this venue.')
        return
      }
      traderCap.cancelOrder(identifier).match(
        () => {
          setCancelError(null)
        },
        (error) => {
          setCancelError(error.message)
        },
      )
    },
    [traderCap],
  )

  // Bulk Cancel-all / Close-all behind a confirm. `requestBulkAction` is a no-op
  // when there is nothing to act on (so the confirm never opens on an empty
  // table); `confirmBulkAction` fans out the per-row action (each emits its own
  // toast) and closes the confirm.
  const requestBulkAction = useCallback(
    (kind: BulkActionKind) => {
      const hasOrders = orders.length > 0
      const hasPositions = positions.length > 0
      const isCancelAllActionable = kind === 'cancel-all' && hasOrders
      const isCloseAllActionable = kind === 'close-all' && hasPositions
      const isActionable = isCancelAllActionable || isCloseAllActionable
      if (!isActionable) return
      setPendingBulkAction(kind)
    },
    [orders.length, positions.length],
  )

  const dismissBulkAction = useCallback(() => {
    setPendingBulkAction(null)
  }, [])

  const requestCancelAll = useCallback(() => requestBulkAction('cancel-all'), [requestBulkAction])
  const requestCloseAll = useCallback(() => requestBulkAction('close-all'), [requestBulkAction])

  const confirmBulkAction = useCallback(() => {
    const isCancelAll = pendingBulkAction === 'cancel-all'
    const isCloseAll = pendingBulkAction === 'close-all'
    if (isCancelAll) orders.forEach((order) => cancelOrder(order.identifier))
    if (isCloseAll) positions.forEach((position) => closePosition(position.symbol))
    setPendingBulkAction(null)
  }, [pendingBulkAction, orders, positions, cancelOrder, closePosition])

  const fillsHistoryError =
    fillsReader.error === null ? null : historyErrorMessage(fillsReader.error, 'trade history')
  const orderHistoryError =
    ordersReader.error === null ? null : historyErrorMessage(ordersReader.error, 'order history')
  const fundingError =
    fundingReader.error === null ? null : historyErrorMessage(fundingReader.error, 'funding history')
  const interestError =
    interestReader.error === null
      ? null
      : historyErrorMessage(interestReader.error, 'interest history')
  const activityError =
    activityReader.error === null
      ? null
      : historyErrorMessage(activityReader.error, 'account activity')

  // Position ordering: largest |notional| first so high-conviction lines surface
  // at the top of the tab regardless of subscription order; equal notionals tie
  // -break by symbol ascending so the list is stable across re-renders.
  const sortedPositions = useMemo(() => {
    const copy = positions.slice()
    copy.sort((positionA, positionB) => {
      const notionalA = Math.abs(positionA.positionValueUsd)
      const notionalB = Math.abs(positionB.positionValueUsd)
      const notionalDelta = notionalB - notionalA
      const isNotionalTie = notionalDelta === 0
      if (!isNotionalTie) return notionalDelta
      return positionA.symbol.localeCompare(positionB.symbol)
    })
    return copy
  }, [positions])

  // Parse each position's raw Hyperliquid coin (bare `BTC` for main-dex,
  // namespaced `xyz:NVDA` for HIP-3) into its display parts here, so the dumb
  // Positions row never calls `parseHip3Symbol` inline. The PositionRow renders
  // `displaySymbol` plus, for HIP-3, a `dexTag` badge.
  const positionRows = useMemo<ReadonlyArray<PositionRowView>>(
    () =>
      sortedPositions.map((position) => {
        const { isHip3, dexTag, displaySymbol } = parseHip3Symbol(position.symbol)
        const tpsl = derivePositionTpsl(orders, position)
        return { position, displaySymbol, dexTag, isHip3, tpsl }
      }),
    [sortedPositions, orders],
  )

  const arePositionsLoading = hasPositions && !positionsLoaded
  const areOpenOrdersLoading = hasOpenOrders && !openOrdersLoaded
  const areTwapsLoading = hasTwap && !twapsLoaded

  // Bulk-action affordance for the active tab's toolbar slot (rendered inline
  // with the tab strip in AccountDock — see account-dock.module.css
  // `.tabsToolbar`). Mirrors the per-tab `showRows`/`isEmpty` gating that used
  // to live inside PositionsPanel/OpenOrdersPanel before the button moved out
  // of their own row.
  const showCloseAll =
    activeTab === 'positions' && hasTrader && !arePositionsLoading && positionRows.length > 0
  const showCancelAll =
    activeTab === 'openOrders' && hasTrader && !areOpenOrdersLoading && orders.length > 0
  const toolbarAction = showCloseAll
    ? { label: 'Close all', ariaLabel: 'Close all positions', onClick: requestCloseAll }
    : showCancelAll
      ? { label: 'Cancel all', ariaLabel: 'Cancel all orders', onClick: requestCancelAll }
      : null

  return {
    activeTab,
    setActiveTab,
    positions: sortedPositions,
    positionRows,
    arePositionsLoading,
    areOpenOrdersLoading,
    areTwapsLoading,
    orders,
    fills: fillsReader.rows,
    fillsCount: fillsReader.count,
    fillsPagination: fillsReader.pagination,
    loadOlderFills: fillsReader.loadOlder,
    isLoadingOlderFills: fillsReader.isLoading,
    isFillsExhausted: fillsReader.isExhausted,
    fillsHistoryError,
    cancelOrder,
    cancelError,
    closePosition,
    submitClose,
    managedPosition,
    openManage,
    closeManage,
    protectionPosition,
    openProtection,
    closeProtection,
    submitProtection,
    clearProtection,
    hasPositionProtection,
    modifiedOrder,
    openModify,
    closeModify,
    submitModify,
    hasModifyOrder,
    pendingBulkAction,
    requestBulkAction,
    requestCancelAll,
    requestCloseAll,
    toolbarAction,
    bulkActionCount: pendingBulkAction === 'cancel-all' ? orders.length : sortedPositions.length,
    confirmBulkAction,
    dismissBulkAction,
    historicalOrders: ordersReader.rows,
    ordersCount: ordersReader.count,
    ordersPagination: ordersReader.pagination,
    loadOlderOrders: ordersReader.loadOlder,
    isLoadingOrderHistory: ordersReader.isLoading,
    isOrderHistoryExhausted: ordersReader.isExhausted,
    orderHistoryError,
    fundingCount: fundingReader.count,
    fundingPagination: fundingReader.pagination,
    isLoadingFunding: fundingReader.isLoading,
    fundingError,
    interestCount: interestReader.count,
    interestPagination: interestReader.pagination,
    isLoadingInterest: interestReader.isLoading,
    interestError,
    activityCount: activityReader.count,
    activityPagination: activityReader.pagination,
    isLoadingActivity: activityReader.isLoading,
    activityError,
    explorerTxUrl: venue.metadata.explorerTxUrl,
    activeTwaps,
    hasPositions,
    hasOpenOrders,
    hasTradeHistory,
    hasOrderHistory,
    hasFundingHistory,
    hasInterestHistory,
    hasAccountActivity,
    hasTwap,
    hasTrader,
    isSpectating,
    isMobile,
    shareView,
    canShare: canAct,
    onSharePosition,
    onShareFill,
    closeShare,
  }
}
