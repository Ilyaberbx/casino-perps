import { letterColor } from './asset-icon.utils'
import styles from './asset-icon.module.css'
import type { LetterPlaceholderProps } from './asset-icon.types'

/**
 * Dumb sub-component rendering a colored-letter chip as a fallback for missing icons.
 * No state, no effects — render-only.
 *
 * Internal sub-component of asset-icon/; not exported from index.ts.
 */
export function LetterPlaceholder({ letter, size }: LetterPlaceholderProps) {
  return (
    <div
      className={styles.letterPlaceholder}
      role="img"
      aria-label={letter}
      style={{
        backgroundColor: letterColor(letter),
        fontSize: `calc(${size}px * 0.55)`,
      }}
    >
      {letter.toUpperCase()}
    </div>
  )
}
