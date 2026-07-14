/**
 * Cloid prefix for a position-close order, so the venue fill it books is
 * recognisable as originating from this app (PRD 0008 decision 7). Same prefix
 * order entry uses — a close is the reduce-only counterpart of an open.
 */
export const CLOSE_CLOID_PREFIX = 'a99a' as const

/** How many closed trades the history keeps in view (newest first). */
export const CLOSED_TRADES_LIMIT = 30
