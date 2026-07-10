import type { BetAmountChipsProps } from './casino-trade.types'
import styles from './casino-trade.module.css'

/** [ $10 ] [ $50 ] [ $100 ] [ MAX ] — the bet-amount (margin) chips. */
export function BetAmountChips({ presets, betAmount, onSelect, onMax }: BetAmountChipsProps) {
  return (
    <div className={styles.chipRow} data-testid="bet-amount-chips" role="group" aria-label="Bet amount">
      {presets.map((amount) => {
        const isActive = amount === betAmount
        const chipClass = isActive ? `${styles.chip} ${styles.chipActive}` : styles.chip
        return (
          <button
            key={amount}
            type="button"
            className={chipClass}
            aria-pressed={isActive}
            onClick={() => onSelect(amount)}
          >
            ${amount}
          </button>
        )
      })}
      <button type="button" className={`${styles.chip} ${styles.chipMax}`} onClick={onMax}>
        MAX
      </button>
    </div>
  )
}
