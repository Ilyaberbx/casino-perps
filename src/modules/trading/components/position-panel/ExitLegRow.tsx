import styles from './position-panel.module.css'
import type { ExitLegRowProps } from './position-panel.types'

/**
 * One exit leg: a trigger price, and — the part that matters — what that price
 * is actually worth to you. The ROE chip answers the question a bare price does
 * not: "if this fires, do I make 8% or 140%?"
 */
export function ExitLegRow({ label, hint, value, roiPct, issue, onChange }: ExitLegRowProps) {
  const hasRoi = roiPct !== null
  const isUp = hasRoi && roiPct >= 0

  return (
    <div className={styles.legRow}>
      <div className={styles.legHead}>
        <label className={styles.legLabel} htmlFor={`exit-${label}`}>
          {label}
        </label>
        {hasRoi ? (
          <span
            className={`${styles.roiChip} ${isUp ? styles.up : styles.down}`}
            data-testid={`roi-${label}`}
          >
            {isUp ? '+' : ''}
            {roiPct.toFixed(1)}% ROE
          </span>
        ) : null}
      </div>
      <input
        id={`exit-${label}`}
        className={issue === null ? styles.legInput : `${styles.legInput} ${styles.legInputError}`}
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={hint}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={issue !== null}
      />
      {issue === null ? null : <p className={styles.legIssue}>{issue}</p>}
    </div>
  )
}
