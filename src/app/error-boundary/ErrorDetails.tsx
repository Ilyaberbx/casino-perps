import { ERROR_COPY } from './error-boundary.constants'
import styles from './error-boundary.module.css'
import type { ErrorDetailsProps } from './error-boundary.types'

/** Collapsible technical panel: the server correlation id (when the failure
 *  reached the backend) plus the full copy-paste report. Pure viewer — the copy
 *  affordance lives in the parent's help band. */
export function ErrorDetails({ normalized, report }: ErrorDetailsProps) {
  return (
    <details className={styles.details}>
      <summary className={styles.detailsSummary}>{ERROR_COPY.detailsSummary}</summary>

      <div className={styles.detailsBody}>
        {normalized.requestId ? (
          <p className={styles.requestId}>
            <span className={styles.requestIdLabel}>{ERROR_COPY.requestIdLabel}</span>
            <code className={styles.requestIdValue}>{normalized.requestId}</code>
          </p>
        ) : null}

        <pre className={styles.report}>{report}</pre>
      </div>
    </details>
  )
}
