import styles from './wordmark.module.css'
import { BRAND_NAME } from '../../brand.constants'
import { SIZE_CLASS } from './wordmark.constants'
import type { WordmarkProps } from './wordmark.types'

/**
 * The casino wordmark. Renders {@link BRAND_NAME} as text in the display face —
 * deliberately NOT an image and NOT yeet's logo SVG (PRD 0008 D10). Pure
 * presentational; brand geometry lives in the CSS module.
 */
export function Wordmark({ size = 'md', className }: WordmarkProps) {
  const wordmarkClass = [styles.wordmark, SIZE_CLASS[size], className].filter(Boolean).join(' ')
  return <span className={wordmarkClass}>{BRAND_NAME}</span>
}
