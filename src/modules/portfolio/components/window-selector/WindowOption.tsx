import styles from './window-selector.module.css'
import type { WindowOptionProps } from './window-selector.types'

export function WindowOption({ window, isActive, onSelect }: WindowOptionProps) {
  const className = isActive ? `${styles.option} ${styles.optionActive}` : styles.option
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={className}
      onClick={() => onSelect(window)}
    >
      {window}
    </button>
  )
}
