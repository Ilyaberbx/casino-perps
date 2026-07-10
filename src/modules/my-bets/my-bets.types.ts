/** A casino bet direction. `up` = long (buy), `down` = short (sell). */
export type BetDirection = 'up' | 'down'

/**
 * One open bet, projected from a `PerpPositionSnapshot` for the LIVE BETS list.
 * `profitUsd` is the unrealised profit/loss in quote currency (D16 vocabulary:
 * "profit" / "loss", never "PnL"); `liquidationSentence` is the always-shown
 * plain-prose liquidation warning (D16). `symbol` is the venue market symbol
 * (the Cash Out target); `ticker` is the display coin (`BTC`).
 */
export interface LiveBet {
  readonly symbol: string
  readonly ticker: string
  readonly direction: BetDirection
  readonly leverage: number
  readonly profitUsd: number
  readonly isWinning: boolean
  readonly liquidationSentence: string
  readonly isCashingOut: boolean
}

/**
 * One settled bet, projected from a close `Fill` for the SETTLED history list.
 * `profitUsd` is the realised profit/loss the close booked; `isWin` drives the
 * win/loss tone.
 */
export interface SettledBet {
  readonly id: string
  readonly ticker: string
  readonly direction: BetDirection
  readonly profitUsd: number
  readonly isWin: boolean
  readonly timestamp: number
}

export interface MyBetsPageView {
  readonly cashLabel: string
  readonly isConnected: boolean
  onAddCash(): void
  onWithdraw(): void
  readonly liveBets: ReadonlyArray<LiveBet>
  onCashOut(symbol: string): void
  readonly settledBets: ReadonlyArray<SettledBet>
}

export interface CashHeaderProps {
  readonly cashLabel: string
  readonly isConnected: boolean
  onAddCash(): void
  onWithdraw(): void
}

export interface LiveBetsSectionProps {
  readonly bets: ReadonlyArray<LiveBet>
  onCashOut(symbol: string): void
}

export interface LiveBetRowProps {
  readonly bet: LiveBet
  onCashOut(symbol: string): void
}

export interface SettledBetsSectionProps {
  readonly bets: ReadonlyArray<SettledBet>
}

export interface SettledBetRowProps {
  readonly bet: SettledBet
}
