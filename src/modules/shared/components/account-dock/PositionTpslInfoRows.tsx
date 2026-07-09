import { formatTokenAmount, formatUsd } from '@/modules/shared/utils/format-number'
import styles from './account-dock.module.css'
import type { PositionTpslInfoRowsProps } from './position-tpsl.types'

export function PositionTpslInfoRows({ position, displaySymbol }: PositionTpslInfoRowsProps) {
  const isLong = position.side === 'long'
  const sizeLabel = `${isLong ? '+' : '-'}${formatTokenAmount(Math.abs(position.size))} ${displaySymbol}`
  const sizeClass = isLong ? styles.tpslSizeLong : styles.tpslSizeShort
  return (
    <dl className={styles.tpslInfoRows}>
      <div className={styles.tpslInfoRow}>
        <dt className={styles.tpslInfoLabel}>Asset</dt>
        <dd className={styles.tpslInfoValue}>{displaySymbol}</dd>
      </div>
      <div className={styles.tpslInfoRow}>
        <dt className={styles.tpslInfoLabel}>Size</dt>
        <dd className={`${styles.tpslInfoValue} ${sizeClass}`}>{sizeLabel}</dd>
      </div>
      <div className={styles.tpslInfoRow}>
        <dt className={styles.tpslInfoLabel}>Value</dt>
        <dd className={styles.tpslInfoValue}>{formatUsd(Math.abs(position.positionValueUsd))}</dd>
      </div>
      <div className={styles.tpslInfoRow}>
        <dt className={styles.tpslInfoLabel}>Entry Price</dt>
        <dd className={styles.tpslInfoValue}>{formatTokenAmount(position.entryPrice)}</dd>
      </div>
      <div className={styles.tpslInfoRow}>
        <dt className={styles.tpslInfoLabel}>Mark Price</dt>
        <dd className={styles.tpslInfoValue}>{formatTokenAmount(position.markPrice)}</dd>
      </div>
    </dl>
  )
}
