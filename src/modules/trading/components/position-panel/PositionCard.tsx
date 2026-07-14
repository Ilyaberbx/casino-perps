import { PixelButton } from '@/modules/shared/components/pixel-button'
import { Badge } from '@/modules/shared/components/badge'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import styles from './position-panel.module.css'
import type { PositionCardProps } from './position-panel.types'

/**
 * The open position, at a glance: which way you are, how big, what it is worth
 * right now, and the two numbers that decide the trade — unrealised PnL and the
 * liquidation price. Plus the one action you always need: flatten it.
 */
export function PositionCard({
  position,
  liquidationPriceText,
  baseAsset,
  isClosing,
  onClose,
}: PositionCardProps) {
  const isLong = position.side === 'long'
  const isUp = position.unrealizedPnlUsd >= 0
  const toneClass = isUp ? styles.up : styles.down

  return (
    <div className={styles.card} data-testid="position-card">
      <div className={styles.cardHead}>
        <Badge tone={isLong ? 'directionUp' : 'directionDown'}>
          {isLong ? 'LONG' : 'SHORT'}
        </Badge>
        <span className={styles.leverage}>{position.leverage}×</span>
        <span className={styles.marginMode}>{position.leverageType}</span>
        <span className={styles.size} data-testid="position-size">
          {formatTokenAmount(Math.abs(position.size))} {baseAsset}
        </span>
      </div>

      <div className={styles.pnlRow}>
        <span className={`${styles.pnl} ${toneClass}`} data-testid="position-pnl">
          {formatUsd(position.unrealizedPnlUsd, { signed: true })}
        </span>
        <span className={`${styles.roe} ${toneClass}`} data-testid="position-roe">
          {position.roePct >= 0 ? '+' : ''}
          {position.roePct.toFixed(2)}%
        </span>
      </div>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Entry</dt>
          <dd>{formatUsd(position.entryPrice)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Mark</dt>
          <dd>{formatUsd(position.markPrice)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Liq. price</dt>
          <dd className={styles.liq} data-testid="position-liquidation">
            {liquidationPriceText === null ? '--' : `$${liquidationPriceText}`}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Margin</dt>
          <dd>{formatUsd(position.marginUsedUsd)}</dd>
        </div>
      </dl>

      <PixelButton
        variant={isLong ? 'directionDown' : 'directionUp'}
        size="md"
        fullWidth
        elevated
        disabled={isClosing}
        onClick={onClose}
        data-testid="close-position"
      >
        {isClosing ? 'Closing…' : `Close ${formatUsd(position.positionValueUsd)}`}
      </PixelButton>
    </div>
  )
}
