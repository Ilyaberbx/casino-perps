import { AgentIcon } from './AgentIcon'
import {
  SUGGESTION_PENDING_COPY,
  SUGGESTION_PENDING_TITLE,
} from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestPendingNoticeProps } from './perp-suggestion-sheet.types'

/**
 * The async-pending working beat (ADR-0073). The durable job is in flight; the
 * sheet stays closable and the user is toasted on resolution — so the copy says
 * exactly that. The agent icon animates (static under reduced-motion). Dumb.
 */
export function SuggestPendingNotice({
  iconKind,
  animated,
}: SuggestPendingNoticeProps) {
  return (
    <div
      className={styles.loader}
      role="status"
      aria-live="polite"
      data-testid="suggestion-pending"
    >
      <AgentIcon
        kind={iconKind}
        animated={animated}
        size={48}
        className={styles.loaderIcon}
      />
      <p className={styles.pendingTitle}>{SUGGESTION_PENDING_TITLE}</p>
      <p className={styles.pendingCopy}>{SUGGESTION_PENDING_COPY}</p>
    </div>
  )
}
