import styles from './market-selection-window.module.css'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { Badge } from '@/modules/shared/components/badge'
import { deriveChangeDisplay, formatCompactUsd } from '../../trading.utils'
import { formatPrice, specFromMarket } from '@/modules/shared/utils/format-price'
import { deriveMarketRowTag } from './market-row.utils'
import type { MarketRowProps } from './market-selection-window.types'

/**
 * Dumb row component for the MarketSelectionWindow list.
 * Zero hooks — all state owned by useMarketSelectionWindow.
 * Row anatomy (see ADR-0016): icon · symbol · name · tag · price · 24h% · volume · star.
 * The tag conveys, by market type: perp → max leverage (`20x`); HIP-3 → the
 * dex short name (`xyz`); spot → `SPOT`.
 */
export function MarketRow({
  market,
  isFavorite,
  isSelected,
  onSelect,
  onToggleFavorite,
}: MarketRowProps) {
  const rowClass = isSelected ? `${styles.row} ${styles.rowSelected}` : styles.row

  const { tagLabel, displaySymbol } = deriveMarketRowTag(market)

  const markPrice = market.markPrice ?? 0
  const change24hPct = market.change24hPct ?? 0
  const volume24h = market.volume24h ?? 0

  // change24hPct is stored as a signed fraction (0.05 = +5%); the shared
  // formatter renders it ×100 (the pre-ADR-0016 row printed the raw fraction so
  // a +5% move read as "+0.05%").
  const { display: changeDisplay, direction: changeDataDirection } =
    deriveChangeDisplay(change24hPct)

  const changeClass =
    changeDataDirection === 'up'
      ? `${styles.change} ${styles.changeUp}`
      : changeDataDirection === 'down'
      ? `${styles.change} ${styles.changeDown}`
      : `${styles.change} ${styles.changeNeutral}`

  const starLabel = isFavorite
    ? `Remove ${displaySymbol} from Watchlist`
    : `Add ${displaySymbol} to Watchlist`

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const isEnter = event.key === 'Enter'
    const isSpace = event.key === ' '
    if (isEnter || isSpace) {
      event.preventDefault()
      onSelect(market.symbol)
    }
  }

  function handleStarClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onToggleFavorite(market.symbol)
  }

  return (
    <div
      className={rowClass}
      role="button"
      tabIndex={0}
      aria-label={`Select ${displaySymbol}`}
      onClick={() => onSelect(market.symbol)}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.iconCol}>
        <AssetIcon market={market} size={24} />
      </div>

      <div className={styles.nameCol}>
        <span className={styles.symbolText}>{displaySymbol}</span>
        <span className={styles.nameText}>{market.baseAsset}</span>
      </div>

      <Badge tone="neutral" size="md" className={styles.typeBadge}>
        {tagLabel}
      </Badge>

      <span className={styles.priceCol}>{formatPrice(markPrice, specFromMarket(market))}</span>

      <span className={changeClass} data-direction={changeDataDirection}>
        {changeDisplay}
      </span>

      <span className={styles.volumeCol}>{formatCompactUsd(volume24h)}</span>

      <button
        type="button"
        className={isFavorite ? styles.starActive : styles.star}
        onClick={handleStarClick}
        aria-label={starLabel}
        aria-pressed={isFavorite}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
            d="M8 1.75l1.86 3.77 4.16.6-3.01 2.94.71 4.14L8 11.25l-3.72 1.95.71-4.14L1.98 6.12l4.16-.6L8 1.75z"
          />
        </svg>
      </button>
    </div>
  )
}
