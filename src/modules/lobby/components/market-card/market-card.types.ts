export interface MarketCardProps {
  /** Raw venue symbol, e.g. `'BTC'`, `'BTC-PERP'`, `'xyz:AAPL'`. Drives the
   *  deterministic gradient, the display ticker, and the logo lookup. */
  symbol: string
  /** 24h change as a percentage number: `2.4` renders `+2.4%` (win), `-3.1`
   *  renders `-3.1%` (loss). Not a fraction — the lobby data layer converts. */
  changePct: number
  /** Optional pre-resolved token-logo URL. When absent, the card resolves one
   *  from `symbol` via the shared icon plumbing; on load failure or when nothing
   *  resolves, it falls back to the symbol's first three letters. */
  logoUrl?: string
}

export interface UseMarketCardResult {
  gradient: string
  logoSrc: string | null
  initials: string
  ticker: string
  isUp: boolean
  changeLabel: string
  onLogoError: () => void
}
