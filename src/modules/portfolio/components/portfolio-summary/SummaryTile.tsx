import styles from './portfolio-summary.module.css'
import type { SummaryTileProps } from './portfolio-summary.types'

const TONE_CLASS = {
  up: styles.toneUp,
  down: styles.toneDown,
  neutral: '',
} as const

export function SummaryTile({ label, value, tone }: SummaryTileProps) {
  const toneClass = TONE_CLASS[tone]
  const valueClass = toneClass ? `${styles.value} ${toneClass}` : styles.value
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={valueClass} data-tone={tone}>
        {value}
      </span>
    </div>
  )
}
