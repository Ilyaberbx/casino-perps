import type { OrderDraft } from '@/modules/shared/domain'

/** A casino bet direction. `up` = long (buy), `down` = short (sell). */
export type BetDirection = 'up' | 'down'

/**
 * The state of the confirm-sheet primary button. Drives both the label and the
 * click action:
 * - `connect` — no wallet: open the Create Account / Log In modal.
 * - `add-cash` — connected but no balance (D6): open Add Cash (deposit).
 * - `setting-up` — running the silent agent approve-and-register (D6 loader).
 * - `placing` — the market order is in flight.
 * - `place-bet` — ready to submit the bet.
 */
export type ConfirmCta = 'connect' | 'add-cash' | 'setting-up' | 'placing' | 'place-bet'

export interface ConfirmCtaInput {
  readonly isConnected: boolean
  readonly hasBalance: boolean
  readonly isSettingUp: boolean
  readonly isPlacing: boolean
}

/** The place-bet flow phase (D6). */
export type PlaceBetPhase = 'idle' | 'setting-up' | 'placing'

/** Everything the confirm sheet renders for a pending bet. */
export interface PendingBet {
  readonly direction: BetDirection
  readonly betAmount: number
  readonly leverage: number
  readonly ticker: string
  /** The liquidation prose (D16) — always shown, never a labelled number. */
  readonly liquidationSentence: string
  readonly cta: ConfirmCta
  readonly draft: OrderDraft
}
