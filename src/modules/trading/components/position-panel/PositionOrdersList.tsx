import { PositionOrderRow } from './PositionOrderRow'
import styles from './position-panel.module.css'
import type { PositionOrdersListProps } from './position-panel.types'

/** The resting orders on this market — the protection and the exits. Renders
 *  nothing when there are none; an empty heading is just noise. */
export function PositionOrdersList({
  orders,
  baseAsset,
  cancellingOrderIds,
  onCancel,
}: PositionOrdersListProps) {
  if (orders.length === 0) return null

  return (
    <div className={styles.orders} data-testid="position-orders">
      <span className={styles.ordersHeading}>Open Orders</span>
      <ul className={styles.ordersList}>
        {orders.map((order) => (
          <PositionOrderRow
            key={String(order.identifier)}
            order={order}
            baseAsset={baseAsset}
            isCancelling={cancellingOrderIds.has(String(order.identifier))}
            onCancel={onCancel}
          />
        ))}
      </ul>
    </div>
  )
}
