import styles from './connection-status-bar.module.css'
import { useConnectionStatusBar } from './use-connection-status-bar'

export function ConnectionStatusBar() {
  const { networkLabel, connectionStatus, addressTail } = useConnectionStatusBar()

  return (
    <div className={styles.root}>
      <span className={styles.item}>{networkLabel}</span>
      <span className={styles.separator} />
      <span className={styles.item}>
        <span
          className={styles.dot}
          data-status={connectionStatus}
          data-testid="connection-dot"
        />
        WebSockets
      </span>
      <span className={styles.separator} />
      <span className={styles.item}>
        {addressTail !== null ? addressTail : 'Wallet Disconnected'}
      </span>
    </div>
  )
}
