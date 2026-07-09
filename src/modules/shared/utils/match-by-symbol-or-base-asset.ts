/**
 * Case-insensitive substring match of an already-lowercased query against a
 * market-like item's display symbol and base asset. The query is matched as-is —
 * callers decide whether to trim and lowercase, so each search surface keeps its
 * own empty-query semantics. Shared by Market Selection and the Perp Suggestion
 * token list, which both search markets by symbol + base asset.
 */
export function matchesSymbolOrBaseAsset(
  item: { symbol: string; baseAsset: string },
  loweredQuery: string,
): boolean {
  const symbolMatches = item.symbol.toLowerCase().includes(loweredQuery)
  const baseAssetMatches = item.baseAsset.toLowerCase().includes(loweredQuery)
  return symbolMatches || baseAssetMatches
}
