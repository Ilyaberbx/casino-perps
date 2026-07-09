import styles from './market-selection-window.module.css'
import type { MarketSearchInputProps } from './market-selection-window.types'

/**
 * Dumb controlled search input for the MarketSelectionWindow.
 * Zero hooks — value and onChange come from the parent component
 * which binds to the smart hook's handleSearchChange.
 * autoFocus is set so the user can type immediately on window open.
 */
export function MarketSearchInput({ value, onChange }: MarketSearchInputProps) {
  return (
    <input
      type="search"
      className={styles.searchInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search markets…"
      aria-label="Search markets"
      autoFocus
    />
  )
}
