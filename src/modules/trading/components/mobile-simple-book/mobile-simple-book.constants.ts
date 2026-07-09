/**
 * Levels per side in the Simple-mode book. Shallower than the pro mobile rail's
 * `MOBILE_VISIBLE_DEPTH` (7) — the combined card stacks the book above the tape,
 * so a 5-deep ladder keeps both readable without a tall scroll.
 */
export const SIMPLE_BOOK_DEPTH = 5 as const
