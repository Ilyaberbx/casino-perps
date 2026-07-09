/** Cadence for re-reading the live wallet USDC balance in `needs-funding`. */
export const WALLET_BALANCE_POLL_MS = 5_000

/**
 * Fraction of the deposited amount the live account value must rise by, above
 * the PRE-broadcast baseline, before we call the deposit `credited`. A deposit
 * of `amount` USDC lands as ~`amount` of account value; requiring at least half
 * of it (a) tolerates small mark-price / PnL jitter on existing positions in
 * either direction (no false-positive on an unrelated rise, no false-negative
 * on a tiny adverse tick), and (b) ties the completion signal causally to THIS
 * deposit rather than "any strict rise after subscribing" (CR-02).
 */
export const CREDIT_TOLERANCE = 0.5
