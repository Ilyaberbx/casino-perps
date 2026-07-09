import styles from './account-dock.module.css'
import type { OrderHistoryRowProps } from './account-dock.types'
import { Badge } from '@/modules/shared/components/badge'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import { directionLabel, formatHistoryTime } from './account-dock.utils'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import { historicalOrderStatusLabel } from '@/modules/shared/utils/historical-order-status'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

export function OrderHistoryRow({ order }: OrderHistoryRowProps) {
  const isLong = order.side === 'buy'
  const filledSize = Math.max(0, order.originalSize - order.size)
  const orderValueUsd = order.price * order.originalSize
  const reduceOnlyLabel = order.reduceOnly ? 'Yes' : 'No'
  const triggerLabel = order.isTrigger ? `Px ${formatTokenAmount(order.triggerPrice)}` : '--'

  return (
    <div className={`${styles.row} ${styles.orderHistoryRow}`}>
      <span className={styles.cell}>
        <FitCell align="left">{formatHistoryTime(order.createdAt)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{order.orderType}</FitCell>
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
        <FitCell>{formatTokenAmount(order.originalSize)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(filledSize)}</FitCell>
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
      <span className={styles.cell}>
        <FitCell>{historicalOrderStatusLabel(order.status)}</FitCell>
      </span>
      <span className={`${styles.cell} ${styles.orderIdCell}`}>
        <FitCell>{order.identifier}</FitCell>
      </span>
    </div>
  )
}
