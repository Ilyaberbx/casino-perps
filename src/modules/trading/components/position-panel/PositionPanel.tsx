import { usePositionPanel } from './use-position-panel'
import { PositionCard } from './PositionCard'
import { PositionOrdersList } from './PositionOrdersList'
import styles from './position-panel.module.css'

/**
 * The per-market position surface on the trade page: your open position in this
 * market, its resting orders, and the actions on both. Renders nothing when flat
 * — the trade page then shows only the order ticket.
 *
 * This is the depth the casino build had none of: you could open a position but
 * never see it, protect it, or close it from the screen you opened it on.
 */
export function PositionPanel() {
  const panel = usePositionPanel()

  if (!panel.position) return null

  return (
    <div className={styles.panel} data-testid="position-panel">
      <PositionCard
        position={panel.position}
        liquidationPriceText={panel.liquidationPriceText}
        baseAsset={panel.baseAsset}
        isClosing={panel.isClosing}
        onClose={panel.closePosition}
      />
      {panel.showsOrders ? (
        <PositionOrdersList
          orders={panel.orders}
          baseAsset={panel.baseAsset}
          cancellingOrderIds={panel.cancellingOrderIds}
          onCancel={panel.cancelOrder}
        />
      ) : null}
    </div>
  )
}
