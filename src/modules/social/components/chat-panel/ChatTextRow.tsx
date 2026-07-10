import { splitTextTokens } from '../../social.utils'
import styles from './chat-panel.module.css'
import type { ChatTextRowProps } from './chat-panel.types'

export function ChatTextRow({ message }: ChatTextRowProps) {
  const tokens = splitTextTokens(message.text)

  return (
    <div className={styles.message}>
      <span className={styles.avatar} aria-hidden="true">
        {message.user.avatar}
      </span>
      <span className={styles.messageBody}>
        <span className={styles.username} style={{ color: message.user.color }}>
          {message.user.name}:
        </span>
        {tokens.map((token, index) => (
          <span
            key={`${message.id}-${index}`}
            className={token.isMention ? styles.mention : styles.text}
          >
            {token.text}
          </span>
        ))}
      </span>
    </div>
  )
}
