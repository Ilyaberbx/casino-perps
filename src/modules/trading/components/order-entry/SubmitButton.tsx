import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './order-entry.module.css'
import type { OrderType, SubmitButtonProps } from './order-entry.types'

const ORDER_TYPE_LABELS: Readonly<Record<OrderType, string>> = {
  market: 'Market',
  limit: 'Limit',
  'stop-market': 'Stop Market',
  'stop-limit': 'Stop Limit',
  twap: 'TWAP',
}

export function SubmitButton({
  side,
  orderType,
  isDisabled,
  isSubmitting,
  onSubmit,
}: SubmitButtonProps) {
  const isBuy = side === 'buy'
  const variant = isBuy ? 'directionUp' : 'directionDown'
  const sideLabel = isBuy ? 'Buy' : 'Sell'
  const orderTypeLabel = ORDER_TYPE_LABELS[orderType]
  const buttonLabel = isSubmitting ? 'Submitting…' : `${sideLabel} ${orderTypeLabel}`
  return (
    <div className={styles.submitWrapper}>
      <PixelButton
        variant={variant}
        size="md"
        fullWidth
        elevated
        disabled={isDisabled}
        onClick={onSubmit}
        aria-label={`Submit ${orderTypeLabel.toLowerCase()} ${sideLabel.toLowerCase()} order`}
      >
        {buttonLabel}
      </PixelButton>
    </div>
  )
}
