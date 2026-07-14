/** The side of an open perps position. Mirrors `PerpPositionSnapshot['side']`. */
export type PositionSide = 'long' | 'short'

/**
 * One open position, projected from a `PerpPositionSnapshot`. `pnlUsd` is the
 * unrealised PnL in quote currency and `liquidationPriceText` the formatted
 * liquidation price (`null` when the venue has not reported one) — a labelled
 * number, not the prose warning the casino build used. `symbol` is the venue
 * market symbol (the close target); `ticker` is the display coin (`BTC`).
 */
export interface OpenPositionRow {
  readonly symbol: string
  readonly ticker: string
  readonly side: PositionSide
  readonly leverage: number
  readonly pnlUsd: number
  readonly isUp: boolean
  readonly liquidationPriceText: string | null
  readonly isClosing: boolean
}

/**
 * One closed trade, projected from a close `Fill`. `pnlUsd` is the realised PnL
 * the close booked; `isUp` drives the profit/loss tone.
 */
export interface ClosedTradeRow {
  readonly id: string
  readonly ticker: string
  readonly side: PositionSide
  readonly pnlUsd: number
  readonly isUp: boolean
  readonly timestamp: number
}

export interface PositionsPageView {
  readonly equityLabel: string
  readonly isConnected: boolean
  onDeposit(): void
  onWithdraw(): void
  readonly openPositions: ReadonlyArray<OpenPositionRow>
  onClose(symbol: string): void
  readonly closedTrades: ReadonlyArray<ClosedTradeRow>
}

export interface AccountHeaderProps {
  readonly equityLabel: string
  readonly isConnected: boolean
  onDeposit(): void
  onWithdraw(): void
}

export interface OpenPositionsSectionProps {
  readonly positions: ReadonlyArray<OpenPositionRow>
  onClose(symbol: string): void
}

export interface OpenPositionRowProps {
  readonly position: OpenPositionRow
  onClose(symbol: string): void
}

export interface ClosedTradesSectionProps {
  readonly trades: ReadonlyArray<ClosedTradeRow>
}

export interface ClosedTradeRowProps {
  readonly trade: ClosedTradeRow
}
