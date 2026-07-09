import styles from './top-bar.module.css'
import type { MarketDropdownButtonProps } from './top-bar.types'

/**
 * Dumb trigger button that replaces MarketDropdown (the <select> element).
 * Reuses existing CSS classes from top-bar.module.css unchanged:
 *   .marketDropdown, .marketDropdownLabel, .marketDropdownChevron
 *
 * Note: AssetIcon (size={20}) is spec'd in UI-SPEC section 2 but is not
 * included here because it requires Plan 06-04 wiring. The text label +
 * chevron is sufficient for the trigger's function.
 * TODO(06-04): add <AssetIcon market={selectedMarketObj} size={20} /> when TopBar wires this.
 *
 * MarketDropdown.tsx is NOT deleted here — deletion happens in Plan 06-04
 * when TopBar.tsx is updated. Both files can coexist until then.
 */
export function MarketDropdownButton({
  label,
  dexTag,
  isOpen,
  onClick,
}: MarketDropdownButtonProps) {
  const ariaLabel = dexTag ? `${label} on ${dexTag}` : label

  return (
    <button
      type="button"
      className={styles.marketDropdown}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={`Select market, currently ${ariaLabel}`}
    >
      <span className={styles.marketDropdownLabel}>{label}</span>
      {dexTag ? <span className={styles.marketDropdownDexTag}>{dexTag}</span> : null}
      <svg
        className={styles.marketDropdownChevron}
        viewBox="0 0 12 12"
        width="10"
        height="10"
        aria-hidden="true"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 4.5l3 3 3-3"
        />
      </svg>
    </button>
  )
}
