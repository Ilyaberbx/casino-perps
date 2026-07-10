import { ChatComposer } from './ChatComposer'
import { ChatHeader } from './ChatHeader'
import { ChatMessageRow } from './ChatMessageRow'
import { useChat } from './use-chat'
import styles from './chat-panel.module.css'

export function ChatPanel() {
  const {
    messages,
    scrollRef,
    draft,
    handleDraftChange,
    handleSubmit,
    canSubmit,
    collapsed,
    onToggleCollapse,
    onlineCount,
  } = useChat()

  return (
    <section className={styles.panel} aria-label="Live chat">
      <ChatHeader collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      {!collapsed && (
        <>
          <div className={styles.body} ref={scrollRef} data-testid="chat-body">
            {messages.map((message) => (
              <ChatMessageRow key={message.id} message={message} />
            ))}
          </div>
          <ChatComposer
            draft={draft}
            onChange={handleDraftChange}
            onSubmit={handleSubmit}
            canSubmit={canSubmit}
          />
          <footer className={styles.footer}>
            <span>Chat Rules</span>
            <span className={styles.footerCount}>
              <span className={styles.onlineDot} aria-hidden="true" />
              {onlineCount}
            </span>
          </footer>
        </>
      )}
    </section>
  )
}
