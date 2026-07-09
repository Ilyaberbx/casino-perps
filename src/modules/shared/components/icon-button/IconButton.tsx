import styles from './icon-button.module.css'
import type { IconButtonProps } from './icon-button.types'

const ICON_SIZE_PX = 14

/**
 * The shared icon-only control for dense terminal surfaces (account-dock row
 * actions, the AI sheet close). Square + hairline-framed, calm at rest (ADR-0043
 * "data stays square"); the lucide glyph renders with square caps + miter joins
 * so it reads sprite-style, not rounded-vector (DESIGN.md). Text CTAs use
 * `PixelButton`; this is its icon-only sibling. Dumb leaf — every non-glyph
 * button attribute (onClick, title, aria-*, data-*) passes straight through.
 */
export function IconButton({
  icon: Icon,
  ariaLabel,
  tone = 'neutral',
  type = 'button',
  elevated = false,
  className,
  ref,
  ...rest
}: IconButtonProps) {
  const composed = [styles.iconButton, styles[tone], elevated ? styles.elevated : null, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button ref={ref} type={type} className={composed} aria-label={ariaLabel} {...rest}>
      <Icon
        size={ICON_SIZE_PX}
        strokeWidth={2}
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden
      />
    </button>
  )
}
