import type { ProTypeMenuProps } from './order-entry.types'
import styles from './order-entry.module.css'

/**
 * The Pro dropdown's listbox: the capability-filtered advanced order types in
 * reference order (TWAP, Stop Limit, Stop Market). Dumb — virtual focus,
 * keyboard handling, and selection live in `useOrderTypeControl`. Skinned with
 * the pixel-art dropdown tokens (hard borders, square corners).
 */
export function ProTypeMenu({
  descriptors,
  activeIndex,
  selectedType,
  listboxId,
  optionId,
  listRef,
  onListKeyDown,
  onOptionClick,
}: ProTypeMenuProps) {
  return (
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label="Pro order types"
      aria-activedescendant={optionId(activeIndex)}
      tabIndex={-1}
      className={styles.proMenu}
      onKeyDown={onListKeyDown}
    >
      {descriptors.map((descriptor, index) => {
        const isSelected = descriptor.value === selectedType
        const isActive = index === activeIndex
        const rowClass = isActive
          ? `${styles.proOption} ${styles.proOptionActive}`
          : styles.proOption
        return (
          <li
            key={descriptor.value}
            id={optionId(index)}
            role="option"
            aria-selected={isSelected}
            className={rowClass}
            onClick={() => onOptionClick(index)}
          >
            {descriptor.label}
          </li>
        )
      })}
    </ul>
  )
}
