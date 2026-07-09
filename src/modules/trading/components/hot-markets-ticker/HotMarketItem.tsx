import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { deriveChangeDisplay } from '../../trading.utils'
import styles from './hot-markets-ticker.module.css'
import type { HotMarketItemProps } from './hot-markets-ticker.types'

/**
 * Dumb ticker item: token icon · base symbol · signed, colour-coded 24h change.
 * Clicking selects the market on the trading page. Zero hooks.
 */
export function HotMarketItem({ market, isActive, onSelect }: HotMarketItemProps) {
  const { display, direction } = deriveChangeDisplay(market.change24hPct ?? 0)
  const buttonClass = isActive
    ? `${styles.itemButton} ${styles.itemActive}`
    : styles.itemButton

  return (
    <li className={styles.item}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onSelect(market.symbol)}
        aria-label={`View ${market.baseAsset} market`}
      >
        <AssetIcon market={market} size={18} />
        <span className={styles.symbol}>{market.baseAsset}</span>
        <span className={styles.change} data-direction={direction}>
          {display}
        </span>
      </button>
    </li>
  )
}
