import styles from './stat-row.module.css'
import type { StatRowProps, StatRowTone } from './stat-row.types'

const toneClass: Record<StatRowTone, string | undefined> = {
  neutral: undefined,
  up: styles.toneUp,
  down: styles.toneDown,
  muted: styles.toneMuted,
}

export function StatRow({ label, value, tone = 'neutral', noDivider = false, className }: StatRowProps) {
  const rowClass = [styles.row, noDivider ? styles.noDivider : null, className]
    .filter(Boolean)
    .join(' ')
  const valueClass = [styles.value, toneClass[tone]].filter(Boolean).join(' ')
  return (
    <div className={rowClass}>
      <span className={styles.label}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
