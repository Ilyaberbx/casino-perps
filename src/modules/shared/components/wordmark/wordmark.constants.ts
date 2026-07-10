import styles from './wordmark.module.css'
import type { WordmarkSize } from './wordmark.types'

export const SIZE_CLASS: Record<WordmarkSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
} as const
