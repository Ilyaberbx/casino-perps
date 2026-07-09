import { MobileBottomNav } from '../mobile-bottom-nav'
import { PerpSuggestionSheet } from '../perp-suggestion-sheet'
import { SuggestionPreviewSheet } from '../suggestion-preview'
import { useMobileTradeDock } from './use-mobile-trade-dock'
import styles from './mobile-trade-dock.module.css'

/**
 * The mobile trading dock: the fixed footer nav (Trade / Portfolio / Ask AI /
 * Account) plus the AI suggestion + preview sheets it drives. Both the trading
 * page and the portfolio page mount it on mobile, so the footer and its actions
 * are identical across routes. Place Order is no longer here — order entry is an
 * inline card on the trade page (chosen layout). Requires the trade-context
 * providers as ancestors (the /trade route nests them around `TradingPage`; the
 * portfolio page wraps the dock in `TradeDockProviders`).
 */
export function MobileTradeDock() {
  const { openAskAi, openAccount, openSettings } = useMobileTradeDock()

  return (
    <>
      <div className={styles.navSlot} data-testid="trading-mobile-bottom-nav-slot">
        <MobileBottomNav
          onAskAi={openAskAi}
          onAccount={openAccount}
          onSettings={openSettings}
        />
      </div>
      <PerpSuggestionSheet />
      <SuggestionPreviewSheet />
    </>
  )
}
