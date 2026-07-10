import type { BetDirection, PendingBet } from '../../hooks/casino-trade.types'
import type { LiveBetView } from '../../hooks/use-live-bet'

export interface MarketHeaderProps {
  readonly ticker: string
  readonly markPrice: number
  /** 24h change as a signed fraction (`0.024` = +2.4%), or `null` when unknown. */
  readonly change24hPct: number | null
}

export interface BetAmountChipsProps {
  readonly presets: ReadonlyArray<number>
  readonly betAmount: number
  onSelect(amount: number): void
  onMax(): void
}

export interface MultiplierControlProps {
  readonly leverage: number
  readonly maxLeverage: number
  /** Commit a new multiplier (signs the venue set-leverage) — on release only. */
  onChange(leverage: number): void
}

export interface DirectionButtonsProps {
  readonly canBet: boolean
  onPick(direction: BetDirection): void
}

export interface ConfirmBetSheetProps {
  readonly pendingBet: PendingBet | null
  onClose(): void
  onPrimary(): void
}

export interface LiveBetRowProps {
  readonly liveBet: LiveBetView
  readonly isCashingOut: boolean
  onCashOut(): void
}
