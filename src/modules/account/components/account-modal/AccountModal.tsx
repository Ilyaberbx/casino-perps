import { Modal } from '@/modules/shared/components/modal'
import { useAccountModalContent } from './use-account-modal-content'
import { AccountModalNav } from './AccountModalNav'
import { ProfileSection } from './ProfileSection'
import { MfaSection } from './MfaSection'
import { WalletsSection } from './WalletsSection'
import styles from './account-modal.module.css'
import type { AccountSection } from './account-modal.types'

/**
 * The Account Modal shell (PRD-0006 UI-2). Opened from the header avatar; desktop
 * renders a left sidebar + content pane, mobile a top tab strip near-fullscreen.
 * Default section is Profile. Replaces the retired `AccountMenu` dropdown.
 */
export function AccountModal() {
  const view = useAccountModalContent()
  if (!view.isOpen) return null

  const layoutClass = view.isMobile ? `${styles.layout} ${styles.layoutMobile}` : styles.layout

  return (
    <Modal isOpen onClose={view.onClose} ariaLabel="Account" title="Account">
      <div data-testid="account-modal" className={layoutClass}>
        <AccountModalNav
          isMobile={view.isMobile}
          activeSection={view.activeSection}
          navItems={view.navItems}
          onSelectSection={view.onSelectSection}
        />
        <div className={styles.pane}>
          <SectionBody section={view.activeSection} />
        </div>
      </div>
    </Modal>
  )
}

function SectionBody({ section }: { section: AccountSection }) {
  if (section === 'profile') return <ProfileSection />
  if (section === 'mfa') return <MfaSection />
  return <WalletsSection />
}
