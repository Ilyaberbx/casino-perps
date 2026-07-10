/**
 * The `/trade/:symbol` route href for a market. `:symbol` seeds the trade
 * screen's `SelectedMarketProvider` (see `app/router.tsx`). Percent-encodes the
 * symbol so a HIP-3 dex prefix (`xyz:AAPL`) survives the path segment; the
 * router decodes it back before it reaches `useParams`.
 */
export function tradeHref(symbol: string): string {
  return `/trade/${encodeURIComponent(symbol)}`
}
