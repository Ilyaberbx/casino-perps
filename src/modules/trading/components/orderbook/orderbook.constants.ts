/**
 * How many levels the data layer buffers per side, and the default depth the
 * desktop book renders. The desktop rail is scrollable (nado-style): rows are a
 * fixed height and the full buffered depth scrolls within `.side` rather than
 * being padded to a static count.
 *
 * Raised 25 → 50 → 60 for #291: with the scrollbar now hidden but the rail still
 * scrollable, we surface noticeably more levels to scroll through. The render is
 * a single fixed larger window (no lazy load-on-scroll — the depth ceiling is
 * modest enough that rendering it all is cheap and dodges scroll-jank). The book
 * renders up to whatever the venue actually supplies: the mock venue emits
 * `ORDERBOOK_DEPTH` (60) levels per side (raised in lockstep so dev/mock actually
 * fills this deeper ladder); a venue that streams deeper books (e.g. Hyperliquid
 * l2Book) fills toward 60.
 */
export const DISPLAY_DEPTH = 60 as const

/** Baseline per-side depth for the loading skeleton (both sides + spread). */
export const VISIBLE_DEPTH = 11 as const

/**
 * Levels per side on mobile, where the book sits in a short rail under the chart.
 * Shallower than the desktop ladder so the fixed-height rows fit without scroll.
 */
export const MOBILE_VISIBLE_DEPTH = 7 as const

/** Skeleton rows shown while the book loads: both sides plus the spread divider, so it occupies the resting height. */
export const SKELETON_ROWS = VISIBLE_DEPTH * 2 + 1
