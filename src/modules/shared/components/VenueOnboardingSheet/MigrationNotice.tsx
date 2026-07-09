import styles from './venue-onboarding-sheet.module.css'
import type { MigrationNoticeProps } from './venue-onboarding-sheet.types'

export function MigrationNotice({ onDismiss }: MigrationNoticeProps) {
  return (
    <div className={styles.migrationNotice} role="note" data-testid="migration-notice">
      <span>
        One more step: you've already approved an agent, and now need to approve a builder
        fee to keep trading.
      </span>
      <button
        type="button"
        className={styles.migrationDismiss}
        onClick={onDismiss}
        aria-label="Dismiss migration notice"
      >
        ×
      </button>
    </div>
  )
}
