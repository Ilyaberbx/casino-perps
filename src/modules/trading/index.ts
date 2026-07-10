export { TradingPage } from './pages/TradingPage'
export { HotMarketsTicker } from './components/hot-markets-ticker'
export { MobileTradeDock } from './components/mobile-trade-dock'
// The casino app shell owns the global mobile tab bar (PRD 0008 §6, D8) and the
// market-search overlay (D15 demotes MarketSelectionWindow from primary nav).
export { MobileBottomNav } from './components/mobile-bottom-nav'
export { MarketSelectionWindow } from './components/market-selection-window'
export { TradeDockProviders } from './providers/trade-dock-providers'
export { SelectedMarketProvider } from './providers/selected-market-provider'
export { LeverageMarginProvider } from './providers/leverage-margin'
export { OrderIntentProvider } from './providers/order-intent-provider'
export { type MarketSymbol } from './providers/selected-market-provider'
export { DEFAULT_SELECTED_MARKET } from './providers/selected-market-provider/selected-market-provider.constants'
export { FavoritesProvider } from './providers/favorites-provider'
