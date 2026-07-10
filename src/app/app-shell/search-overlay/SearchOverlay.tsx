import { MarketSelectionWindow } from '@/modules/trading'
import { useSearchOverlay } from './use-search-overlay'

export interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * The market-search overlay (PRD 0008 D15). The former primary-nav
 * `MarketSelectionWindow` demoted to an overlay behind the center-column
 * magnifier. Dumb shell around it; {@link useSearchOverlay} owns the
 * pick-a-market → navigate-to-trade behaviour.
 */
export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { selectedMarket, handleSelectMarket } = useSearchOverlay({ onClose })

  return (
    <MarketSelectionWindow
      isOpen={isOpen}
      onClose={onClose}
      onSelectMarket={handleSelectMarket}
      selectedMarket={selectedMarket}
    />
  )
}
