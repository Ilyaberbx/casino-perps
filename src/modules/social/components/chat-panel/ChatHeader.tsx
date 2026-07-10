import { PanelRightClose, Settings } from 'lucide-react'
import styles from './chat-panel.module.css'
import type { ChatHeaderProps } from './chat-panel.types'

export function ChatHeader({ collapsed, onToggleCollapse }: ChatHeaderProps) {
  const collapseLabel = collapsed ? 'Expand chat' : 'Collapse chat'

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onToggleCollapse}
        aria-label={collapseLabel}
        aria-expanded={!collapsed}
        data-testid="chat-collapse"
      >
        <PanelRightClose size={18} aria-hidden="true" />
      </button>
      <h2 className={styles.headerTitle}>Live Chat</h2>
      <button type="button" className={styles.iconButton} aria-label="Chat settings">
        <Settings size={18} aria-hidden="true" />
      </button>
    </header>
  )
}
