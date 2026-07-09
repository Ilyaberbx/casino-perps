import { Popover } from '@/modules/shared/components/popover'
import { useWalletRowMenu } from './use-wallet-row-menu'
import { NON_EXPORTABLE_NOTE } from './account-modal.constants'
import styles from './account-modal.module.css'
import type { WalletRowMenuProps } from './account-modal.types'

/**
 * The per-row overflow (⋮) menu (PRD-0006 UI-5 / Slice 06 / ADR-0076 D-5). Owns
 * its own open/close + the `Copy address` action via `useWalletRowMenu`. Renders
 * a `Remove` item for imported wallets only (Native/Agent pass
 * `isRemovable={false}`). Renders an `Export private key` item when the wallet is
 * owner-exportable (`isExportable`); for a link-only `external` wallet (not
 * exportable) it renders a friendly non-export note in its place. Self-contained
 * widget, not a slice of the parent row's state. The dropdown is positioned by
 * the shared `Popover` (portaled to `document.body`) so it floats above the
 * rows below it instead of colliding with them (ADR-0037).
 */
export function WalletRowMenu({ address, isRemovable, isExportable, onRemove }: WalletRowMenuProps) {
  const { isOpen, anchorRef, panelRef, onToggle, onCopy, onRemove: onRemoveConfirmed, onExport } =
    useWalletRowMenu(address, onRemove)

  return (
    <div className={styles.menu}>
      <button
        ref={anchorRef}
        type="button"
        className={styles.menuTrigger}
        aria-label="Wallet actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        ⋮
      </button>
      {isOpen && (
        <Popover anchorRef={anchorRef} panelRef={panelRef} placement="bottom-end">
          <div ref={panelRef} role="menu" className={styles.menuPopover}>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={onCopy}>
              Copy address
            </button>
            {isExportable ? (
              <button type="button" role="menuitem" className={styles.menuItem} onClick={onExport}>
                Export private key
              </button>
            ) : (
              <p className={styles.menuNote}>{NON_EXPORTABLE_NOTE}</p>
            )}
            {isRemovable && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItemDanger}
                onClick={onRemoveConfirmed}
              >
                Remove
              </button>
            )}
          </div>
        </Popover>
      )}
    </div>
  )
}
