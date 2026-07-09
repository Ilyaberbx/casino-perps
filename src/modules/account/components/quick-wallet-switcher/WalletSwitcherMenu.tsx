import { Web3Avatar } from '../account-avatar/Web3Avatar'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import type { WalletSwitcherMenuProps } from './quick-wallet-switcher.types'
import styles from './quick-wallet-switcher.module.css'

const ROW_AVATAR_SIZE_PX = 24

/**
 * The menu body: one selectable wallet row per wallet (avatar + label + a check
 * on the Selected Wallet) over an `Import wallet` footer. Dumb — every action
 * comes from `use-quick-wallet-switcher`. The Selected row is disabled (selecting
 * it is a no-op). The parent owns the `Popover`-positioned panel node (with the
 * panel ref + `.menu` skin); this renders its contents.
 */
export function WalletSwitcherMenu({
  items,
  value,
  isImporting,
  isImportAtCap,
  importHint,
  onSelectWallet,
  onImport,
}: WalletSwitcherMenuProps) {
  return (
    <>
      <ul className={styles.list}>
        {items.map((item) => {
          const isSelected = item.value === value
          const rowClass = isSelected ? `${styles.row} ${styles.rowSelected}` : styles.row
          return (
            <li key={item.value}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className={rowClass}
                disabled={isSelected}
                onClick={() => onSelectWallet(item.address)}
              >
                <Web3Avatar iconUrl={null} address={item.address} size={ROW_AVATAR_SIZE_PX} />
                <span className={styles.rowLabel}>{item.label}</span>
                {isSelected && (
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <div className={styles.footer}>
        <PixelButton
          type="button"
          variant="accent"
          data-testid="quick-wallet-import"
          disabled={isImportAtCap || isImporting}
          onClick={onImport}
        >
          {isImporting ? 'Importing…' : 'Import wallet'}
        </PixelButton>
        {isImportAtCap && <span className={styles.hint}>{importHint}</span>}
      </div>
    </>
  )
}
