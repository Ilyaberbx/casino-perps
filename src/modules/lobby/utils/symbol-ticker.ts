/**
 * The display ticker for a poster card — the bare, uppercased base coin of a
 * venue symbol. Strips a HIP-3 dex prefix (`xyz:AAPL` → `AAPL`), a spot quote
 * (`BTC/USDC` → `BTC`), and a market-type suffix (`BTC-PERP` → `BTC`). Plain
 * perp symbols pass through unchanged. Pure.
 */
export function displayTicker(symbol: string): string {
  const afterDexPrefix = symbol.includes(':') ? symbol.slice(symbol.indexOf(':') + 1) : symbol
  const beforeQuote = afterDexPrefix.split('/')[0]
  const withoutTypeSuffix = beforeQuote.replace(/-(PERP|SPOT)$/i, '')
  return withoutTypeSuffix.toUpperCase()
}

/**
 * The first three letters of a symbol's display ticker — the poster-card logo
 * fallback shown in the display face when no token logo resolves.
 */
export function symbolInitials(symbol: string): string {
  return displayTicker(symbol).slice(0, 3)
}
