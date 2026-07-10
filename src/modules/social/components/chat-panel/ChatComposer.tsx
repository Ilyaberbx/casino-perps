import { Send, Smile } from 'lucide-react'
import styles from './chat-panel.module.css'
import type { ChatComposerProps } from './chat-panel.types'

export function ChatComposer({ draft, onChange, onSubmit, canSubmit }: ChatComposerProps) {
  return (
    <form className={styles.composer} onSubmit={onSubmit}>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type="text"
          value={draft}
          onChange={onChange}
          placeholder="Type your message..."
          aria-label="Chat message"
          maxLength={280}
        />
        <span className={styles.emojiHint} aria-hidden="true">
          <Smile size={18} />
        </span>
      </div>
      <button type="submit" className={styles.sendButton} disabled={!canSubmit}>
        <Send size={16} aria-hidden="true" />
        Chat
      </button>
    </form>
  )
}
