import styles from './delegation-consent.module.css'

/**
 * Dumb segmented control of TTL presets (7 / 30 / 90 days) for the delegation
 * grant. Receives the options + the selected value from the parent's hook and
 * forwards a pick — no state of its own.
 */
export function TtlPresetChips(props: {
  presets: readonly number[]
  selected: number
  onSelect(days: number): void
}) {
  return (
    <div className={styles.presets} role="group" aria-label="Delegation expiry">
      {props.presets.map((days) => {
        const isSelected = days === props.selected
        const className = isSelected
          ? `${styles.presetChip} ${styles.presetChipActive}`
          : styles.presetChip
        return (
          <button
            key={days}
            type="button"
            className={className}
            aria-pressed={isSelected}
            onClick={() => props.onSelect(days)}
          >
            {days}d
          </button>
        )
      })}
    </div>
  )
}
