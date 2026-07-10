/**
 * Cloid prefix for a Cash Out order, so the venue fill it books is recognisable
 * as originating from this app (PRD 0008 decision 7). Same prefix the order
 * entry uses — a Cash Out is the reduce-only counterpart of a Place Bet.
 */
export const CASH_OUT_CLOID_PREFIX = 'a99a' as const

/** How many settled bets the SETTLED history keeps in view (newest first). */
export const SETTLED_BETS_LIMIT = 30
