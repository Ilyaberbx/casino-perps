import type { Unsubscribe } from '../domain.types'

/**
 * Whether the venue account keeps Spot and Perp as separate balances.
 *
 * `isSegregated: true` — classic account: Spot and Perp are distinct balances
 * that must be moved between with an explicit transfer (the Transfer feature
 * applies). `false` — a unified / portfolio-margin account where Spot and Perp
 * share one balance/collateral pool, so no transfer is needed and balances are
 * reported as a single pool. Unknown account state is treated as segregated
 * (the classic assumption) so a transient read failure never strips a classic
 * user of the Transfer affordance. See ADR-0033.
 */
export interface AccountMode {
  readonly isSegregated: boolean
}

/**
 * Venue-agnostic account-structure signal. Keeps venue-specific mode vocabulary
 * (e.g. Hyperliquid's `unifiedAccount`/`portfolioMargin`) inside the venue
 * module — consumers see only `{ isSegregated }`. Consumed by the Transfer gate
 * (`isApplicable = isSegregated`) and the portfolio scope toggle.
 */
export interface AccountModeReader {
  current(): AccountMode
  subscribe(onChange: (mode: AccountMode) => void): Unsubscribe
}
