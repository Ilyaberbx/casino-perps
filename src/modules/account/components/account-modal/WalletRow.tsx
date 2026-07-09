import { Web3Avatar } from '../account-avatar/Web3Avatar'
import { WalletRowMenu } from './WalletRowMenu'
import styles from './account-modal.module.css'
import type { WalletRowProps } from './account-modal.types'

const ROW_AVATAR_SIZE_PX = 28

/**
 * One user-wallet identity row (PRD-0006 UI-5 / Slice 06). The **whole
 * non-selected row** is a button that selects the wallet; the **Selected** row is
 * non-interactive, shows a `Selected` badge, and carries the accent border. The
 * row icon is the imported wallet's connector brand logo when resolvable
 * (best-effort, via `Web3Avatar`'s `iconUrl` + `FallbackImage` graceful
 * fallback), else the deterministic `Web3Avatar` gradient seeded from the
 * address. The right overflow (⋮) menu hosts `Copy address` and, for imported
 * wallets, `Remove`.
 */
export function WalletRow({ row, onSelect, onRemove }: WalletRowProps) {
  const testId = row.isNative ? 'wallet-row-native' : `wallet-row-${row.address}`
  const rowClass = row.isSelected ? `${styles.walletRow} ${styles.walletRowSelected}` : styles.walletRow

  return (
    <li data-testid={testId} className={rowClass}>
      <button
        type="button"
        className={styles.walletRowSelect}
        disabled={row.isSelected}
        onClick={() => onSelect(row.address)}
      >
        <Web3Avatar
          iconUrl={row.connectorIconUrl}
          address={row.address}
          size={ROW_AVATAR_SIZE_PX}
        />
        <span className={styles.walletRowIdentity}>
          <span className={styles.walletRowAddress}>{row.truncatedAddress}</span>
          <span className={styles.walletRowSource}>{row.sourceLabel}</span>
        </span>
        {row.isSelected && <span className={styles.walletRowBadge}>Selected</span>}
      </button>
      <WalletRowMenu
        address={row.address}
        isRemovable={row.isRemovable}
        isExportable={row.isExportable}
        onRemove={onRemove}
      />
    </li>
  )
}
