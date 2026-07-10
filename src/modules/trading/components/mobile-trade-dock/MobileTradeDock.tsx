/**
 * MobileTradeDock — retired by the casino re-skin (PRD 0008 §6, D8).
 *
 * The mobile footer nav is now owned by the app shell as a global 4-tab bar
 * (Browse / Markets / My Bets / Chat), rendered on every route. This component
 * previously mounted a trade-page-local footer (Trade / Portfolio / Account /
 * Settings); keeping it would double the fixed bottom bar. It renders nothing so
 * the existing `TradingPage` call site stays valid until the Casino Mode trade
 * screen rewrite (build order step 6) removes the mount entirely.
 *
 * TODO(casino-mode phase): delete this component and its `TradingPage` mount.
 */
export function MobileTradeDock() {
  return null
}
