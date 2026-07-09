import { FavoriteStar } from './FavoriteStar'
import { MarketDropdownButton } from './MarketDropdownButton'
import { MarketSelectionWindow } from '../market-selection-window'
import { MobileTickerStrip } from './MobileTickerStrip'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import type { TopBarViewProps } from './top-bar.types'
import styles from './top-bar.module.css'

export function TopBarMobile({
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
  mobileAction,
}: TopBarViewProps) {
  return (
    <div className={styles.mobileContainer}>
      <div className={styles.mobileIdentityRow}>
        <FavoriteStar isFavorite={isFavorite} onToggle={toggleFavorite} />
        {hasResolvedMarket && (
          <div className={styles.iconSlot}>
            <AssetIcon market={market} size={22} />
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
        {mobileAction ? <div className={styles.mobileIdentityAction}>{mobileAction}</div> : null}
      </div>
      <MobileTickerStrip stats={stats} markFlash={markFlash} />
    </div>
  )
}
