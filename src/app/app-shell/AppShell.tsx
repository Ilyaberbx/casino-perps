import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useAppShell } from './use-app-shell'
import { VenueSwitcher } from '../venue-switcher'
import {
  AccountAvatarTrigger,
  AccountModal,
  AccountModalProvider,
  QuickWalletSwitcher,
  useAuth,
  useIsWalletConnected,
} from '@/modules/account'
import { SpectateLauncher, SpectateBanner } from '@/modules/spectate'
import { HotMarketsTicker } from '@/modules/trading'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { ConnectionBanner } from '@/modules/shared/components/connection-banner'
import { VenueOnboardingBanner } from '@/modules/shared/components/VenueOnboardingBanner'
import { VenueOnboardingSheet } from '@/modules/shared/components/VenueOnboardingSheet'
import { DepositSheet } from '@/modules/shared/components/deposit-sheet'
import { TransferSheet } from '@/modules/shared/components/transfer-sheet'
import { ManageFundsModal } from '@/modules/shared/components/manage-funds-modal'
import { SettingsModal } from '@/modules/shared/components/settings-modal'
import { useSettings } from '@/modules/shared/providers/settings-provider'
import { AgentWalletSurface } from '@/modules/agent-balance'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { useDepositSheet } from '@/modules/shared/providers/deposit-sheet-provider'
import styles from './app-shell.module.css'
import { navLinkClassName } from './app-shell.utils'
import type { AppShellOutletContext } from './app-shell.types'

// `Sheet` actions for CTAs the shared module can't reach (wallet, network,
// reload). Slice 5 only emits the generic `retry` CTA so none of these are
// actually invoked yet, but `<VenueOnboardingSheet>` requires the full
// `actions` surface. Slice 6 widens the error taxonomy and starts driving
// these handlers from real per-error CTAs.
const APP_SHELL_SHEET_ACTIONS = {
  reconnectWallet: () => {
    // openConnectModal is wired below at render time
  },
  switchChain: () => undefined,
  reload: () => {
    window.location.reload()
  },
  confirmReset: (message: string) => window.confirm(message),
  openDeposit: () => {
    // the onboarding-close + deposit-open pair is wired below at render time
  },
}

export function AppShell() {
  const { tradeTo, portfolioTo, logoSrc } = useAppShell()
  const { authenticated, openConnectModal, loginWithWallet } = useAuth()
  const isConnected = authenticated
  const isWalletConnected = useIsWalletConnected()
  const location = useLocation()
  const isMobile = useIsMobile()
  const sheet = useVenueOnboardingSheet()
  const depositSheet = useDepositSheet()
  const settings = useSettings()
  // Both the trade and portfolio pages carry the mobile footer (MobileTradeDock)
  // for nav + Account, so the full desktop header is redundant there on mobile.
  // Instead of hiding it entirely (which stranded the venue switcher + spectate),
  // swap in a slim mobile bar that keeps those two app-level controls reachable.
  const isTradeRoute = location.pathname.startsWith('/trade')
  const isPortfolioRoute = location.pathname.startsWith('/portfolio')
  const isMobileChrome = isMobile && (isTradeRoute || isPortfolioRoute)

  const sheetActions = {
    ...APP_SHELL_SHEET_ACTIONS,
    // Fix 3 (ADR-0061): the user is already authenticated; the selected wallet is
    // linked-but-not-connected, so resolving the grant means CONNECTING that wallet
    // into the live Privy session (`loginWithWallet` → Privy connect/loginOrLink),
    // not re-opening the login modal. Once connected it enters `useWallets()` →
    // becomes connectable → `masterAddress` resolves to it → the grant signs as the
    // selected wallet. Errors surface through Privy's own UI; the CTA is fire-and-forget.
    reconnectWallet: () => {
      void loginWithWallet()
    },
    // Sibling sheets must not stack: close onboarding, then open deposit. The
    // user funds in a focused sub-task and re-opens onboarding from the banner.
    openDeposit: () => {
      sheet.close()
      depositSheet.open()
    },
  }

  // On mobile chrome routes the full header is dropped; the venue switcher +
  // spectate launcher (composition-root concerns) are handed to the page via
  // Outlet context so each page renders them inside its OWN header row instead
  // of a second stacked bar. Null on desktop / non-chrome routes.
  const mobileHeaderControls: AppShellOutletContext['mobileHeaderControls'] = isMobileChrome ? (
    <>
      <SpectateLauncher isWalletConnected={isWalletConnected} />
      <QuickWalletSwitcher />
      <VenueSwitcher />
    </>
  ) : null

  return (
    <AccountModalProvider>
    <div className={styles.shell}>
      {isMobileChrome ? null : (
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <img className={styles.logo} src={logoSrc} alt="Invader" />
          <nav className={styles.nav}>
            <NavLink to={tradeTo} className={navLinkClassName}>
              Trade
            </NavLink>
            <NavLink to={portfolioTo} className={navLinkClassName}>
              Portfolio
            </NavLink>
          </nav>
        </div>
        <div className={styles.headerRight}>
          <SpectateLauncher isWalletConnected={isWalletConnected} />
          {isConnected ? (
            <AccountAvatarTrigger />
          ) : (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => openConnectModal?.()}
              data-testid="connect-wallet-button"
            >
              Connect Wallet
            </button>
          )}
          <QuickWalletSwitcher />
          <VenueSwitcher />
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => settings.open('appearance')}
            aria-label="Open settings"
            data-testid="settings-button"
          >
            <Settings size={16} aria-hidden="true" />
            <span className={styles.toggleLabel}>Settings</span>
          </button>
        </div>
      </header>
      )}
      {isMobileChrome ? null : <HotMarketsTicker />}
      <SpectateBanner />
      <VenueOnboardingBanner isWalletConnected={isWalletConnected} />
      <main className={styles.outlet}>
        <Outlet context={{ mobileHeaderControls } satisfies AppShellOutletContext} />
      </main>
      <ConnectionBanner />
      <VenueOnboardingSheet
        isOpen={sheet.isOpen}
        onClose={sheet.close}
        actions={sheetActions}
      />
      <DepositSheet />
      <TransferSheet />
      <ManageFundsModal />
      <SettingsModal />
      <AgentWalletSurface />
      <AccountModal />
    </div>
    </AccountModalProvider>
  )
}
