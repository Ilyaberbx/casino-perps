import type { PortfolioHistoryErrorKind, PortfolioWindowValues } from './portfolio.types'

/**
 * Build a `PortfolioWindowValues` with the same scalar in every period. Used for
 * zero/empty snapshots and for fixtures that do not care about per-window
 * differences. See ADR-0039.
 */
export function uniformPortfolioWindowValues(value: number): PortfolioWindowValues {
  return { '24H': value, '7D': value, '30D': value, AllTime: value }
}

export class PortfolioHistoryError extends Error {
  readonly kind: PortfolioHistoryErrorKind
  constructor(kind: PortfolioHistoryErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'PortfolioHistoryError'
  }
}

/**
 * Shared error union for every Portfolio history reader's `loadOlder()` —
 * see PRD §D8. `'wallet-not-connected'` is intentionally NOT a kind here:
 * tab hooks gate on `useIsWalletConnected()` upstream (PRD §D7) so a
 * disconnected wallet never reaches the reader.
 */
export type PortfolioHistoryFetchError =
  | { kind: 'network' }
  | { kind: 'rate-limited'; retryAfterMs?: number }
  | { kind: 'unknown'; message: string }
