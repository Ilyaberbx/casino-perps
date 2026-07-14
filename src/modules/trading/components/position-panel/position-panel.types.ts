import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'

/** How a resting order relates to the open position — drives the row's label. */
export type PositionOrderKind = 'take-profit' | 'stop-loss' | 'limit'

export interface UsePositionPanelReturn {
  /** The open position in the selected market, or null when flat. */
  position: PerpPositionSnapshot | null
  /** Resting orders on the selected market, newest first. */
  orders: ReadonlyArray<Order>
  /** Hidden while spectating: the orders stream is keyed to the VIEWED address
   *  but the position is keyed to the ACTING one, so showing both together would
   *  pair your position with someone else's orders. */
  showsOrders: boolean
  /** Formatted liquidation price, or null when the venue reports none. */
  liquidationPriceText: string | null
  baseAsset: string
  isClosing: boolean
  /** Market-closes the whole position (reduce-only, opposite side). */
  closePosition: () => void
  cancellingOrderIds: ReadonlySet<string>
  cancelOrder: (order: Order) => void
}

export interface PositionCardProps {
  position: PerpPositionSnapshot
  liquidationPriceText: string | null
  baseAsset: string
  isClosing: boolean
  onClose: () => void
}

export interface PositionOrdersListProps {
  orders: ReadonlyArray<Order>
  baseAsset: string
  cancellingOrderIds: ReadonlySet<string>
  onCancel: (order: Order) => void
}

export interface PositionOrderRowProps {
  order: Order
  baseAsset: string
  isCancelling: boolean
  onCancel: (order: Order) => void
}
