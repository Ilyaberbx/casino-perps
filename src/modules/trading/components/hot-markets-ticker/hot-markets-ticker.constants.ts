/** How many markets the hot-markets ticker shows (top-N by 24h volume). */
export const HOT_MARKET_LIMIT = 14

/** Seconds of scroll time allotted per item — keeps the loop speed roughly
 *  constant regardless of how many items are on screen. */
export const SECONDS_PER_ITEM = 3.2

/** Floor so a short list still scrolls at a calm, readable pace. */
export const MIN_MARQUEE_DURATION_SEC = 24

/** Shimmer pills rendered while the venue market universe loads. */
export const SKELETON_PILL_COUNT = 10
