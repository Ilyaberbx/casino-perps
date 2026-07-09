import styles from './pixel-checkbox.module.css'
import type { PixelCheckboxProps } from './pixel-checkbox.types'

/**
 * Dumb, themed, accessible checkbox — the single shared replacement for the raw
 * native `<input type="checkbox">` scattered across the trading surfaces. The
 * box is the calm-terminal pixel skin (hard hairline frame, accent fill + inset
 * ring on `:checked`, accent focus ring) and works in both themes via tokens.
 *
 * Accessibility: when `label` is set the input is wrapped in the same `<label>`
 * (native association — click + SR name with no `htmlFor`/`id`), so keyboard
 * focus + Space toggle come for free. With no `label`, pass `ariaLabel` for a
 * bare box (row multi-select). The visual fill is colour + an inset ring, never
 * colour alone; `:focus-visible` shows the accent ring.
 */
export function PixelCheckbox({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  className,
}: PixelCheckboxProps) {
  const input = (
    <input
      type="checkbox"
      className={styles.box}
      checked={checked}
      disabled={disabled}
      aria-label={label === undefined ? ariaLabel : undefined}
      onChange={(event) => onChange(event.target.checked)}
    />
  )

  const wrapperClass = [styles.label, disabled ? styles.disabled : null, className]
    .filter(Boolean)
    .join(' ')

  if (label === undefined) {
    return <span className={wrapperClass}>{input}</span>
  }

  return (
    <label className={wrapperClass}>
      {input}
      <span className={styles.labelText}>{label}</span>
    </label>
  )
}
