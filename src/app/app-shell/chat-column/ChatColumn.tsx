import { ChatPanel, DISCLOSURE_TEXT } from '@/modules/social'
import styles from './chat-column.module.css'

/**
 * The right column (355px, PRD 0008 §6). Mounts the self-contained
 * {@link ChatPanel} and renders the standing "simulated" disclosure
 * ({@link DISCLOSURE_TEXT}, PRD §13 R5) as an unobtrusive footer note — the
 * social module deliberately does not render it. Dumb: no props, no state.
 */
export function ChatColumn() {
  return (
    <div className={styles.column} data-testid="chat-column">
      <div className={styles.panelSlot}>
        <ChatPanel />
      </div>
      <p className={styles.disclosure}>{DISCLOSURE_TEXT}</p>
    </div>
  )
}
