import type { CSSProperties } from 'react'
import styles from './account-dock.module.css'
import type { TwapProgressBarProps } from './twap-panel.types'

/**
 * Dumb pixel progress bar for a TWAP row (`executedSize / size`). No shared
 * progress primitive exists; this is an accent fill over a framed track. The
 * fill glides via a compositor-cheap `transform: scaleX` driven by the
 * `--progress-fill` custom property (modernize Concept 8) rather than animating
 * layout `width`, matching the dock's dense pixel aesthetic.
 */
export function TwapProgressBar({ fraction, label }: TwapProgressBarProps) {
  const fillStyle = { '--progress-fill': fraction } as CSSProperties
  return (
    <span className={styles.progressCell}>
      <span
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <span className={styles.progressFill} style={fillStyle} />
      </span>
      <span className={styles.progressLabel}>{label}</span>
    </span>
  )
}
