/**
 * Set of HL coin baseAssets whose SVG icons have dark fills (near-black paths)
 * that would be invisible on a light background (#fbf8cc chip background).
 *
 * Matching is performed against market.baseAsset.toUpperCase() at runtime.
 * The AssetIcon component applies a dark-background container for these coins.
 *
 * Confirmed dark-fill coins: HYPE, KHYPE, XPL, IO (per 04-RESEARCH §Dark-Fill Icons).
 * KHYPE is a distinct ticker (uppercase K) — not a k-multiplier.
 */
export const DARK_FILL_ICON_COINS: ReadonlySet<string> = new Set([
  'HYPE',
  'KHYPE',
  'XPL',
  'IO',
])
