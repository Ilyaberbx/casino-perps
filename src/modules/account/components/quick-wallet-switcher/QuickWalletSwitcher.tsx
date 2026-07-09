import { Web3Avatar } from '../account-avatar/Web3Avatar'
import { Popover } from '@/modules/shared/components/popover'
import { WalletSwitcherMenu } from './WalletSwitcherMenu'
import { useQuickWalletSwitcher } from './use-quick-wallet-switcher'
import styles from './quick-wallet-switcher.module.css'

const TRIGGER_AVATAR_SIZE_PX = 20

/**
 * Header quick-action wallets switcher (sits beside the Venue switcher). Shows
 * the Selected Wallet and opens a menu to switch wallets or import a new one.
 * Renders nothing until the onboarding flow is `ready` (so it is absent when
 * disconnected) — no call-site gate needed in `AppShell`.
 */
export function QuickWalletSwitcher() {
  const {
    isReady,
    triggerItem,
    items,
    value,
    isOpen,
    isCompact,
    isImporting,
    isImportAtCap,
    importHint,
    anchorRef,
    panelRef,
    onToggle,
    onSelectWallet,
    onImport,
  } = useQuickWalletSwitcher()
  if (!isReady || triggerItem === null) return null

  const triggerClass = isCompact ? `${styles.trigger} ${styles.triggerCompact}` : styles.trigger

  return (
    <div className={styles.root}>
      <button
        ref={anchorRef}
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Switch wallet"
        title={triggerItem.label}
        onClick={onToggle}
      >
        <Web3Avatar iconUrl={null} address={triggerItem.address} size={TRIGGER_AVATAR_SIZE_PX} />
        {isCompact ? null : <span className={styles.triggerLabel}>{triggerItem.label}</span>}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen && (
        <Popover anchorRef={anchorRef} panelRef={panelRef} placement="bottom-end">
          <div ref={panelRef} role="menu" aria-label="Wallets" className={styles.menu}>
            <WalletSwitcherMenu
              items={items}
              value={value}
              isImporting={isImporting}
              isImportAtCap={isImportAtCap}
              importHint={importHint}
              onSelectWallet={onSelectWallet}
              onImport={onImport}
            />
          </div>
        </Popover>
      )}
    </div>
  )
}
