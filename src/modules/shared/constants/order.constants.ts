/**
 * Cloid prefix stamped onto orders this app submits, so our fills are
 * recognisable as originating here (PRD decision 7). Mirrors the value in
 * `trading/components/order-entry/order-entry.constants.ts` and
 * `hyperliquid/hyperliquid.constants.ts` — the account-dock lives in `shared/`
 * and cannot import the `trading/` constant, so the placeholder is duplicated
 * here as a shared leaf. PLACEHOLDER: `'a99a'` until the real branded prefix
 * is supplied.
 */
export const ORDER_CLOID_PREFIX = 'a99a' as const
