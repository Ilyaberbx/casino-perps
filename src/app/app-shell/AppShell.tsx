import { Outlet } from 'react-router-dom'
import { AccountModal, AccountModalProvider } from '@/modules/account'
import { LiveWinsTicker } from '@/modules/social'
import { MobileBottomNav } from '@/modules/trading'
import { ConnectionBanner } from '@/modules/shared/components/connection-banner'
import { VenueOnboardingBanner } from '@/modules/shared/components/VenueOnboardingBanner'
import { VenueOnboardingSheet } from '@/modules/shared/components/VenueOnboardingSheet'
import { DepositSheet } from '@/modules/shared/components/deposit-sheet'
import { TransferSheet } from '@/modules/shared/components/transfer-sheet'
import { ManageFundsModal } from '@/modules/shared/components/manage-funds-modal'
import { SettingsModal } from '@/modules/shared/components/settings-modal'
import { useAppShell } from './use-app-shell'
import { LeftRail } from './left-rail'
import { ChatColumn } from './chat-column/ChatColumn'
import { CenterTopBar } from './center-top-bar/CenterTopBar'
import { MobileTopBar } from './mobile-top-bar/MobileTopBar'
import { MobileMenuDrawer } from './mobile-menu-drawer/MobileMenuDrawer'
import { MobileChatSheet } from './mobile-chat-sheet/MobileChatSheet'
import { SearchOverlay } from './search-overlay/SearchOverlay'
import styles from './app-shell.module.css'
import type { AppShellOutletContext } from './app-shell.types'

/**
 * The casino app shell (PRD 0008 §6, D8): a fixed left rail, a fluid scrolling
 * center column topped by a LIVE WINS ticker, and a fixed right chat column,
 * degrading to a mobile top bar + 4-tab bottom nav under 900px. Dumb — all
 * state and actions come from {@link useAppShell}.
 */
export function AppShell() {
  const shell = useAppShell()

  return (
    <AccountModalProvider>
      <div
        className={
          shell.isRailCollapsed ? `${styles.shell} ${styles.shellRailCollapsed}` : styles.shell
        }
      >
        <MobileTopBar onAddCash={shell.handleAddCash} onOpenMenu={shell.openMenu} />

        <aside className={styles.rail}>
          <LeftRail
            collapsed={shell.isRailCollapsed}
            onAddCash={shell.handleAddCash}
            onCollapse={shell.handleCollapse}
          />
        </aside>

        <div className={styles.center}>
          <CenterTopBar
            authenticated={shell.authenticated}
            onOpenSearch={shell.openSearch}
            onLogIn={shell.handleLogIn}
            onCreateAccount={shell.handleCreateAccount}
          />
          <div className={styles.centerScroll}>
            <LiveWinsTicker />
            <VenueOnboardingBanner isWalletConnected={shell.isWalletConnected} />
            <ConnectionBanner />
            <main className={styles.outletWrap}>
              <Outlet context={{ mobileHeaderControls: null } satisfies AppShellOutletContext} />
            </main>
          </div>
        </div>

        <aside className={styles.chat}>
          <ChatColumn />
        </aside>

        <MobileBottomNav onOpenSearch={shell.openSearch} onOpenChat={shell.openChat} />

        <SearchOverlay isOpen={shell.isSearchOpen} onClose={shell.closeSearch} />
        <MobileMenuDrawer
          isOpen={shell.isMenuOpen}
          onClose={shell.closeMenu}
          authenticated={shell.authenticated}
          onAddCash={shell.handleAddCash}
          onLogIn={shell.handleLogIn}
          onCreateAccount={shell.handleCreateAccount}
        />
        <MobileChatSheet isOpen={shell.isChatOpen} onClose={shell.closeChat} />

        <VenueOnboardingSheet
          isOpen={shell.isOnboardingSheetOpen}
          onClose={shell.closeOnboardingSheet}
          actions={shell.onboardingSheetActions}
        />
        <DepositSheet />
        <TransferSheet />
        <ManageFundsModal />
        <SettingsModal />
        <AccountModal />
      </div>
    </AccountModalProvider>
  )
}
