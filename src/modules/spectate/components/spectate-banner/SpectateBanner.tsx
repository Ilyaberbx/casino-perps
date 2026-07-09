import { useSpectateBanner } from './use-spectate-banner'
import styles from './spectate-banner.module.css'

export function SpectateBanner() {
  const { visible, truncatedAddress, onShare, onStop } = useSpectateBanner()

  if (!visible) return null

  return (
    <div className={styles.banner} role="status" aria-live="polite" data-testid="spectate-banner">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>
        Spectating <span className={styles.address}>{truncatedAddress}</span>
      </span>
      <button
        type="button"
        className={styles.shareButton}
        onClick={onShare}
        data-testid="spectate-banner-share"
      >
        Share
      </button>
      <button
        type="button"
        className={styles.exitButton}
        onClick={onStop}
        aria-label="Stop spectating"
        title="Stop spectating (Ctrl+X)"
        data-testid="spectate-banner-stop"
      >
        ×
      </button>
    </div>
  )
}
