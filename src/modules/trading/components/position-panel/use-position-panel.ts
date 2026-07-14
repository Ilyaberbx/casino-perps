import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useCapability,
  useCapabilityOptional,
  useOwnCapability,
} from '@/modules/shared/providers/venue-provider'
import { useIsSpectating } from '@/modules/spectate'
import { toast } from '@/modules/shared/services/toast'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'
import { ORDER_CLOID_PREFIX } from '@/modules/shared/constants/order.constants'
import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { buildMarketCloseRequest } from './position-close.utils'
import { liquidationPriceText } from './position-panel.utils'
import type { UsePositionPanelReturn } from './position-panel.types'

/**
 * The per-market position surface: the open position in the selected market, its
 * resting orders, a full market close, and a per-order cancel.
 *
 * Positions come from the ACTING-address snapshot reader (your own account, even
 * while spectating). Open orders only exist as a VIEWING-keyed capability, so
 * while spectating the two would disagree about whose account they describe —
 * the orders list is hidden in that case rather than pairing your position with
 * someone else's orders.
 */
export function usePositionPanel(): UsePositionPanelReturn {
  const trader = useCapability('trader')
  const positionsCap = useOwnCapability('perpsPositionsSnapshot')
  const openOrdersCap = useCapabilityOptional('openOrdersSnapshot')
  const protectionCap = useCapabilityOptional('positionProtection')
  const isSpectating = useIsSpectating()
  const { selectedMarket, market } = useSelectedMarketContext()

  const [positions, setPositions] = useState<ReadonlyArray<PerpPositionSnapshot>>([])
  const [allOrders, setAllOrders] = useState<ReadonlyArray<Order>>([])
  const [isClosing, setIsClosing] = useState(false)
  const [isExitTargetsOpen, setExitTargetsOpen] = useState(false)
  const [isReduceOpen, setReduceOpen] = useState(false)
  const [cancellingOrderIds, setCancellingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useEffect(() => {
    if (!positionsCap) return
    return positionsCap.subscribe((next) => setPositions(next))
  }, [positionsCap])

  useEffect(() => {
    if (!openOrdersCap) return
    return openOrdersCap.subscribe((next) => setAllOrders(next))
  }, [openOrdersCap])

  const position = useMemo(
    () => positions.find((entry) => entry.symbol === selectedMarket) ?? null,
    [positions, selectedMarket],
  )

  const orders = useMemo(
    () =>
      allOrders
        .filter((order) => order.symbol === selectedMarket)
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp),
    [allOrders, selectedMarket],
  )

  const closePosition = useCallback(() => {
    if (!position || isClosing) return
    setIsClosing(true)
    trader
      .placeOrder(
        buildMarketCloseRequest({
          position,
          size: Math.abs(position.size),
          clientOrderId: generateCloid(ORDER_CLOID_PREFIX),
        }),
      )
      .match(
        () => {
          setIsClosing(false)
          toast.show({
            variant: 'success',
            title: 'Position closed',
            description: position.symbol,
          })
        },
        (error) => {
          setIsClosing(false)
          toast.show({
            variant: 'error',
            title: 'Close failed',
            description: formatVenueErrorMessage(error.message),
          })
        },
      )
  }, [position, isClosing, trader])

  const cancelOrder = useCallback(
    (order: Order) => {
      const id = String(order.identifier)
      if (cancellingOrderIds.has(id)) return
      setCancellingOrderIds((previous) => new Set(previous).add(id))
      trader.cancelOrder(order.identifier).match(
        () => {
          setCancellingOrderIds((previous) => without(previous, id))
          toast.show({ variant: 'success', title: 'Order cancelled' })
        },
        (error) => {
          setCancellingOrderIds((previous) => without(previous, id))
          toast.show({
            variant: 'error',
            title: 'Cancel failed',
            description: formatVenueErrorMessage(error.message),
          })
        },
      )
    },
    [cancellingOrderIds, trader],
  )

  const openExitTargets = useCallback(() => setExitTargetsOpen(true), [])
  const closeExitTargets = useCallback(() => setExitTargetsOpen(false), [])
  const openReduce = useCallback(() => setReduceOpen(true), [])
  const closeReduce = useCallback(() => setReduceOpen(false), [])

  return {
    position,
    orders,
    showsOrders: openOrdersCap !== undefined && !isSpectating,
    // Protection is optional on the port; hide the affordance when the venue
    // cannot honour it rather than offering a button that always fails.
    supportsExitTargets: protectionCap !== undefined && !isSpectating,
    isExitTargetsOpen,
    openExitTargets,
    closeExitTargets,
    isReduceOpen,
    openReduce,
    closeReduce,
    liquidationPriceText: position
      ? liquidationPriceText(position.liquidationPrice, market)
      : null,
    baseAsset: market.baseAsset,
    isClosing,
    closePosition,
    cancellingOrderIds,
    cancelOrder,
  }
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set)
  next.delete(id)
  return next
}
