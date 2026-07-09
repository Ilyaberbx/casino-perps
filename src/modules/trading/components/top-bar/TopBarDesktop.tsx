import { FavoriteStar } from './FavoriteStar'
import { MarketDropdownButton } from './MarketDropdownButton'
import { MarketSelectionWindow } from '../market-selection-window'
import { TickerStats } from './TickerStats'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import type { TopBarViewProps } from './top-bar.types'
import styles from './top-bar.module.css'

export function TopBarDesktop({
  selectedMarket,
  market,
  marketHeaderLabel,
  hasResolvedMarket,
  isWindowOpen,
  openWindow,
  closeWindow,
  handleSelectMarket,
  stats,
  markFlash,
  isFavorite,
  toggleFavorite,
}: TopBarViewProps) {
  return (
    <div className={styles.container}>
      <FavoriteStar isFavorite={isFavorite} onToggle={toggleFavorite} />
      {hasResolvedMarket && (
        <div className={styles.iconSlot}>
          <AssetIcon market={market} size={26} />
        </div>
      )}
      <MarketDropdownButton
        label={marketHeaderLabel.label}
        dexTag={marketHeaderLabel.dexTag}
        isOpen={isWindowOpen}
        onClick={openWindow}
      />
      <MarketSelectionWindow
        isOpen={isWindowOpen}
        onClose={closeWindow}
        onSelectMarket={handleSelectMarket}
        selectedMarket={selectedMarket}
      />
      <TickerStats stats={stats} markFlash={markFlash} />
    </div>
  )
}
