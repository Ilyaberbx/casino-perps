import styles from './placeholder-message.module.css'
import type { PlaceholderMessageProps } from './placeholder-message.types'

export function PlaceholderMessage({
  message,
  children,
  action,
  tone = 'neutral',
  className,
}: PlaceholderMessageProps) {
  const rootClass = [
    styles.root,
    tone === 'error' ? styles.toneError : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={rootClass} role="status">
      <span>{children ?? message}</span>
      {action ? <div>{action}</div> : null}
    </div>
  )
}
