import { Sheet } from '@/modules/shared/components/Sheet'
import { AccountAvatarTrigger } from '@/modules/account'
import { LeftRail } from '../left-rail'
import styles from './mobile-menu-drawer.module.css'
import type { MobileMenuDrawerProps } from './mobile-menu-drawer.types'

/**
 * The mobile rail drawer (< 900px). The hamburger opens it; it hosts an auth row
 * (account avatar, or Log In / Create Account) above the full {@link LeftRail}.
 * Reuses the rail so the mobile menu and desktop rail never drift.
 *
 * The body mounts only while open: `Sheet` keeps its children mounted (marking them
 * `inert` when closed), so an always-rendered body would put a second `LeftRail` and a
 * second account avatar in the DOM alongside the desktop ones — duplicate controls and
 * duplicate test ids for a nav nobody can see.
 */
export function MobileMenuDrawer({
  isOpen,
  onClose,
  authenticated,
  onAddCash,
  onRailAction,
  onLogIn,
  onCreateAccount,
}: MobileMenuDrawerProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="left" ariaLabel="Menu">
      {isOpen && (
        <div className={styles.body} data-testid="mobile-menu-drawer">
          <div className={styles.authRow}>
            {authenticated ? (
              <AccountAvatarTrigger />
            ) : (
              <>
                <button type="button" className={styles.logIn} onClick={onLogIn}>
                  Log In
                </button>
                <button type="button" className={styles.createAccount} onClick={onCreateAccount}>
                  Create Account
                </button>
              </>
            )}
          </div>
          <div className={styles.railSlot}>
            <LeftRail
              collapsed={false}
              onAddCash={onAddCash}
              onCollapse={onClose}
              onRailAction={onRailAction}
            />
          </div>
        </div>
      )}
    </Sheet>
  )
}
