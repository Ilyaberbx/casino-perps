/**
 * `localStorage` key prefix for every cached gateway entry. The `v1` segment
 * lets us invalidate the whole cache en masse after an SDK response-shape
 * change — bump to `v2` and stale `v1` entries are simply never read again.
 */
export const GATEWAY_CACHE_KEY_PREFIX = 'hl-cache:v1' as const

const METADATA_TTL_MS = 60_000
const USER_FEES_TTL_MS = 5 * 60_000

/**
 * The cache allowlist: only these gateway methods are cached, each at its own
 * TTL. Market-universe metadata is near-static (60s); `getUserFees` changes
 * ~daily (5min). Everything else passes straight through. See ADR-0022 for the
 * "always fresh" exclusions (portfolio, balances, candles, history).
 */
export const GATEWAY_CACHE_TTL_MS = {
  getMetaAndAssetCtxs: METADATA_TTL_MS,
  getPerpMetaAndAssetCtxs: METADATA_TTL_MS,
  getSpotMetaAndAssetCtxs: METADATA_TTL_MS,
  getPerpDexs: METADATA_TTL_MS,
  getUserFees: USER_FEES_TTL_MS,
} as const
