import { iconCandidatesForSymbol } from '@/modules/shared/utils/resolve-market-icon-url'

/**
 * The ordered token-logo URL ladder for a raw venue symbol — every rung the
 * shared icon plumbing knows (HL CDN, TradingView logoid, spot bare), so poster
 * cards resolve the same logos the market rows do and walk the same fallbacks
 * on load errors. An empty ladder (or exhausting it) means the card renders the
 * display-face initials placeholder.
 */
export function symbolLogoCandidates(symbol: string): string[] {
  return iconCandidatesForSymbol(symbol)
}
