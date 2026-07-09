import styles from './badge.module.css'
import type { BadgeTone } from './badge.types'

export const TONE_CLASS: Record<BadgeTone, string> = {
  directionUp: styles.toneUp,
  directionDown: styles.toneDown,
  accent: styles.toneAccent,
  neutral: styles.toneNeutral,
} as const
