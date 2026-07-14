import { X } from 'lucide-react'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import styles from './position-panel.module.css'
import { ORDER_KIND_CLASS, ORDER_KIND_LABELS } from './position-panel.constants'
import { positionOrderKind, positionOrderPrice, remainingSize } from './position-panel.utils'
import type { PositionOrderRowProps } from './position-panel.types'

/**
 * One resting order. The kind (take-profit / stop-loss / limit) is read off the
 * venue's own tagging, not inferred — a trader cancelling an order needs to know
 * which one protects them.
 */
export function PositionOrderRow({
  order,
  baseAsset,
  isCancelling,
  onCancel,
}: PositionOrderRowProps) {
  const kind = positionOrderKind(order)
  const isTrigger = order.triggerPrice !== undefined

  return (
    <li className={styles.orderRow} data-testid="position-order-row">
      <span className={`${styles.orderKind} ${styles[ORDER_KIND_CLASS[kind]]}`}>
        {ORDER_KIND_LABELS[kind]}
      </span>
      <span className={styles.orderSize}>
        {formatTokenAmount(remainingSize(order))} {baseAsset}
      </span>
      <span className={styles.orderPrice}>
        <span className={styles.orderPriceLabel}>{isTrigger ? 'Trigger' : 'Limit'}</span>
        {formatUsd(positionOrderPrice(order))}
      </span>
      <button
        type="button"
        className={styles.cancelButton}
        onClick={() => onCancel(order)}
        disabled={isCancelling}
        aria-label={`Cancel ${ORDER_KIND_LABELS[kind]} order`}
        data-testid="cancel-order"
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  )
}
