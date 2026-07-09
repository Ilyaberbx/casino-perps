import type { Unsubscribe } from '../domain.types'
import type { PortfolioAccountScope } from '../portfolio.types'

export type BalanceSource = 'spot' | 'perps' | 'aggregated' | 'unified'

export interface Balance {
  readonly asset: string
  readonly amount: number
  readonly available: number
  readonly amountUsd: number
  readonly pnlPct: number | null
  /**
   * Wallet the balance originates from:
   * - `spot` — spot wallet (rendered with a Spot tag in the dock).
   * - `perps` — perps margin row (the USDC margin balance row).
   * - `aggregated` — Aggregate Balances toggle merged spot + perps rows for the same asset.
   * - `unified` — a unified / portfolio-margin account where Spot and Perp share
   *   one pool: all balances and holds live in the spot clearinghouse state and
   *   the perp margin summary is not meaningful, so there is a single set of rows
   *   (rendered with a Unified tag, no Aggregate toggle). See ADR-0033.
   */
  readonly source: BalanceSource
}

export interface BalancesReader {
  subscribe(
    scope: PortfolioAccountScope,
    onUpdate: (balances: ReadonlyArray<Balance>) => void,
  ): Unsubscribe
}
