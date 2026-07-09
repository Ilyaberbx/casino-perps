import { PixelButton } from '@/modules/shared/components/pixel-button'
import { CopyableAddress } from '@/modules/shared/components/copyable-address'
import { Web3Avatar } from '../account-avatar/Web3Avatar'
import { useProfileSection } from './use-profile-section'
import styles from './account-modal.module.css'

const AVATAR_SIZE_PX = 72

/**
 * Profile section (PRD-0006 UI-3): square pixel avatar + read-only Email and
 * Handle (set-once, with a "permanent" hint), an optional copy on the Native
 * address, and Log out in the footer.
 */
export function ProfileSection() {
  const view = useProfileSection()
  if (view === null) return null

  return (
    <section data-testid="account-section-profile" className={styles.section}>
      <div className={styles.profileAvatar}>
        <Web3Avatar iconUrl={view.iconUrl} address={view.nativeAddress} size={AVATAR_SIZE_PX} />
      </div>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Email</dt>
          <dd data-testid="profile-email" className={styles.rowValue}>
            {view.email}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Handle</dt>
          <dd data-testid="profile-handle" className={styles.rowValue}>
            {view.handle}
            <span className={styles.permanentHint}>Permanent</span>
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowLabel}>Native address</dt>
          <dd className={styles.rowValue}>
            <CopyableAddress address={view.nativeAddress} />
          </dd>
        </div>
      </dl>

      <footer className={styles.footer}>
        <PixelButton
          type="button"
          variant="directionDown"
          fullWidth
          data-testid="profile-logout"
          onClick={view.onLogout}
        >
          Log out
        </PixelButton>
      </footer>
    </section>
  )
}
