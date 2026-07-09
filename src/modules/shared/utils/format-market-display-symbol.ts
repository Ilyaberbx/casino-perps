const PERP_SUFFIX = '-PERP'

/**
 * Projects a market's **identity** symbol to its **display** label by stripping
 * the `-PERP` suffix that perp identity symbols carry (`'BTC-PERP'` → `'BTC'`).
 * This is a render-edge projection only (ADR-0016 amendment): the identity
 * symbol — the `?market=hl:BTC-PERP` URL key, favorites storage, and
 * `MARKET_SYMBOL_PATTERN` — is unchanged. Never feed the result back into a
 * routing call, a favorites lookup, or an `onSelect` payload.
 *
 * Spot pairs (`'HYPE/USDC'`) and HIP-3 symbols (`'xyz:AAPL'`) pass through
 * untouched: spot has no suffix, and HIP-3 display is owned by `parseHip3Symbol`
 * at each call site (stripping the dex prefix here would drop the header's
 * context). A bare symbol with no suffix is returned as-is.
 */
export function formatMarketDisplaySymbol(symbol: string): string {
  const isPerp = symbol.endsWith(PERP_SUFFIX)
  if (!isPerp) return symbol
  return symbol.slice(0, -PERP_SUFFIX.length)
}
