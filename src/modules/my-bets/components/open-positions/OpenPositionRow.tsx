import styles from './open-positions.module.css'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { sideLabel } from '../../my-bets.utils'
import type { OpenPositionRowProps } from '../../my-bets.types'

/**
 * One open-position row: a PnL-tone dot, the coin + side + leverage, the signed
 * unrealised PnL, the liquidation price as a labelled number, and a Close that
 * market-closes the full position. Dumb — the parent owns the handler.
 */
export function OpenPositionRow({ position, onClose }: OpenPositionRowProps) {
  const toneClass = position.isUp ? styles.win : styles.loss

  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <span className={`${styles.dot} ${toneClass}`} aria-hidden="true" />
        <span className={styles.ticker}>{position.ticker}</span>
        <span className={styles.meta}>
          {sideLabel(position.side)} {position.leverage}x
        </span>
        <span className={`${styles.profit} ${toneClass}`} data-testid="position-pnl">
          {formatUsd(position.pnlUsd, { signed: true })}
        </span>
      </div>
      <p className={styles.liquidation}>
        Liq. price{' '}
        <span data-testid="position-liquidation">
          {position.liquidationPriceText === null
            ? '--'
            : `$${position.liquidationPriceText}`}
        </span>
      </p>
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.cashOut}
          onClick={() => onClose(position.symbol)}
          disabled={position.isClosing}
        >
          {position.isClosing ? 'Closing…' : 'Close'}
        </button>
      </div>
    </li>
  )
}
