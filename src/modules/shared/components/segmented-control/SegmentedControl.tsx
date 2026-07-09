import type { CSSProperties } from 'react'
import styles from './segmented-control.module.css'
import type { SegmentedControlProps, SegmentedControlTone } from './segmented-control.types'

const toneClass: Record<SegmentedControlTone, string | undefined> = {
  accent: undefined,
  directionUp: styles.toneDirectionUp,
  directionDown: styles.toneDirectionDown,
}

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  tone = 'accent',
  variant = 'filled',
  ariaLabel,
  className,
}: SegmentedControlProps<TValue>) {
  const isUnderline = variant === 'underline'
  const groupClass = [
    styles.group,
    isUnderline ? styles.underline : null,
    isUnderline ? toneClass[tone] : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  // The underline variant renders a single sliding indicator (one bar that
  // glides between equal-width segments) instead of a per-button underline. The
  // count + active index drive its width/translate via CSS custom properties.
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const indicatorStyle = {
    '--seg-count': options.length,
    '--seg-index': activeIndex,
  } as CSSProperties
  return (
    <div className={groupClass} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value
        const btnClass = [
          styles.btn,
          toneClass[tone],
          isActive ? styles.btnActive : null,
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={option.value}
            type="button"
            className={btnClass}
            aria-pressed={isActive}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            onClick={() => {
              if (!isActive) onChange(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
      {isUnderline && <span className={styles.indicator} style={indicatorStyle} aria-hidden="true" />}
    </div>
  )
}
