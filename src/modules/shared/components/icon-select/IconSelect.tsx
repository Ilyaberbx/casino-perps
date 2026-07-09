import { Fragment } from 'react'
import { Popover } from '../popover'
import { useIconSelect } from './use-icon-select'
import type { IconSelectProps } from './icon-select.types'
import styles from './icon-select.module.css'

/**
 * Pixel-art icon dropdown: a button trigger + a `role="listbox"` popup where
 * each option renders an arbitrary icon node before its label. Image-agnostic —
 * the caller supplies the icon node (see `FallbackImage` for the hybrid
 * remote→local→fallback chain). All state/keyboard logic lives in
 * `useIconSelect`; this component is render-only.
 */
export function IconSelect(props: IconSelectProps) {
  const { options, value, onChange, ariaLabel, className, iconOnly = false } = props
  const {
    isOpen,
    selectedOption,
    activeIndex,
    triggerRef,
    listRef,
    listboxId,
    optionId,
    onTriggerClick,
    onTriggerKeyDown,
    onListKeyDown,
    onOptionClick,
  } = useIconSelect({ options, value, onChange })

  const wrapperClass = className ? `${styles.wrapper} ${className}` : styles.wrapper

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        ref={triggerRef}
        className={iconOnly ? `${styles.trigger} ${styles.triggerIconOnly}` : styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={iconOnly ? selectedOption?.label : undefined}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        {selectedOption?.icon != null && (
          <span className={styles.icon}>{selectedOption.icon}</span>
        )}
        {!iconOnly && <span className={styles.label}>{selectedOption?.label ?? ''}</span>}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen && (
        <Popover anchorRef={triggerRef} panelRef={listRef} placement="bottom-end">
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={optionId(activeIndex)}
          tabIndex={-1}
          className={styles.list}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex && !option.disabled
            const activeClass = isActive ? `${styles.option} ${styles.optionActive}` : styles.option
            const rowClass = option.disabled ? `${styles.option} ${styles.optionDisabled}` : activeClass
            const previousGroup = index > 0 ? options[index - 1].group : undefined
            const isFirstOfGroup = option.group != null && option.group !== previousGroup
            return (
              <Fragment key={option.value}>
                {isFirstOfGroup && (
                  <li className={styles.groupHeader} role="presentation" aria-hidden="true">
                    <span className={styles.groupLabel}>{option.group}</span>
                    <span className={styles.groupChevron}>▴</span>
                  </li>
                )}
                <li
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  className={rowClass}
                  onClick={() => onOptionClick(index)}
                >
                  {option.icon != null && (
                    <span className={styles.icon}>{option.icon}</span>
                  )}
                  <span className={styles.label}>{option.label}</span>
                </li>
              </Fragment>
            )
          })}
        </ul>
        </Popover>
      )}
    </div>
  )
}
