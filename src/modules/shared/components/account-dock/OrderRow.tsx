import { Pencil, X } from 'lucide-react'
import styles from './account-dock.module.css'
import type { OrderRowProps } from './account-dock.types'
import { GatedActionButton } from './GatedActionButton'
import { IconButton } from '@/modules/shared/components/icon-button'
import { Badge } from '@/modules/shared/components/badge'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import { directionLabel, formatHistoryTime } from './account-dock.utils'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

const CANCEL_DISABLED_TOOLTIP = 'Complete Hyperliquid setup to cancel orders'

export function OrderRow({
  order,
  onCancel,
  onModify,
  hasTrader,
  hasModifyOrder,
  showActionsColumn,
}: OrderRowProps) {
  const isLong = order.side === 'buy'
  const originalSize = order.originalSize ?? order.size
  const remainingSize = Math.max(0, order.size - order.filledSize)
  const orderValueUsd = order.price * originalSize
  const typeLabel = order.orderType === 'market' ? 'Market' : 'Limit'
  const reduceOnlyLabel =
    order.reduceOnly === undefined ? '--' : order.reduceOnly ? 'Yes' : 'No'
  const triggerLabel = order.triggerConditions ?? '--'
  // Drop the Actions track while spectating so the row matches the header's
  // one-fewer-column grid.
  const ordersGridClass = showActionsColumn ? styles.ordersRow : styles.ordersRowSpectate

  return (
    <div className={`${styles.row} ${ordersGridClass}`}>
      <span className={styles.cell}>
        <FitCell align="left">{formatHistoryTime(order.timestamp)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{typeLabel}</FitCell>
      </span>
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarketFromSymbol(order.symbol)} size={18} />
          <FitCell align="left">{parseHip3Symbol(order.symbol).displaySymbol}</FitCell>
          <MarketKindTag symbol={order.symbol} />
        </span>
      </span>
      <span className={styles.cell}>
        <Badge tone={isLong ? 'directionUp' : 'directionDown'}>{directionLabel(order.side)}</Badge>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(remainingSize)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(originalSize)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatUsd(orderValueUsd)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(order.price)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{reduceOnlyLabel}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{triggerLabel}</FitCell>
      </span>
      {showActionsColumn ? (
        <span className={`${styles.cell} ${styles.actionsCell}`}>
          {hasTrader ? (
            <span className={styles.rowActions}>
              <GatedActionButton
                icon={X}
                onClick={onCancel}
                disabledTooltip={CANCEL_DISABLED_TOOLTIP}
                ariaLabel="Cancel order"
              />
              {hasModifyOrder ? (
                <IconButton
                  icon={Pencil}
                  elevated
                  ariaLabel="Modify order"
                  title="Modify order"
                  aria-haspopup="dialog"
                  onClick={onModify}
                />
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
