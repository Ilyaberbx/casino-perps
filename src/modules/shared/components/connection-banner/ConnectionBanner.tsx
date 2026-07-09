import { useConnectionBanner } from './use-connection-banner'
import styles from './connection-banner.module.css'

export function ConnectionBanner() {
  const { visible, health, label, hint, isReconnecting, onReconnect } = useConnectionBanner()

  if (!visible) return null

  const isDead = health === 'dead'
  const dotClassName = isDead ? `${styles.dot} ${styles.dotDead}` : styles.dot
  const buttonLabel = isReconnecting ? 'RECONNECTING…' : 'RECONNECT'

  return (
    <div className={styles.banner} role="status" aria-live="polite" data-testid="connection-banner">
      <span className={dotClassName} aria-hidden="true" />
      <div className={styles.copy}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </div>
      <button
        type="button"
        className={styles.reconnectButton}
        onClick={onReconnect}
        disabled={isReconnecting}
        data-testid="connection-banner-reconnect"
      >
        {buttonLabel}
      </button>
    </div>
  )
}
