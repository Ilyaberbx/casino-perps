import { PixelButton } from '@/modules/shared/components/pixel-button'
import { useWalletsSection } from './use-wallets-section'
import { WalletRow } from './WalletRow'
import { SelectedWalletBalancesPanel } from './SelectedWalletBalancesPanel'
import { ImportKeySheet } from './import-key-sheet/ImportKeySheet'
import styles from './account-modal.module.css'

/**
 * Wallets section (PRD-0006 UI-5 / Slice 06 / ADR-0076). Lists the user wallets
 * — the Native row + imported rows — followed by a visually separated,
 * read-only, uncounted Agent row (G-6). The whole non-selected row selects; the
 * selected row shows a `Selected` badge + accent border. The add-wallet row is a
 * split: **Connect external** links a link-only wallet via Privy (the existing
 * flow), while **Import private key** (`ImportKeySheet`) imports a raw key into a
 * Privy embedded wallet (D-6). Both share the `3/3 imported` cap hint.
 */
export function WalletsSection() {
  const view = useWalletsSection()
  if (!view.isReady) return null

  return (
    <section data-testid="account-section-wallets" className={styles.section}>
      <ul className={styles.walletList}>
        {view.rows.map((row) => (
          <WalletRow key={row.address} row={row} onSelect={view.onSelect} onRemove={view.onRemove} />
        ))}
      </ul>

      {/* Per-DEX balance panel for the Selected Wallet (UI-5 / slice 07). */}
      <SelectedWalletBalancesPanel />

      <div className={styles.importRow}>
        <PixelButton
          type="button"
          variant="accent"
          data-testid="wallet-import"
          disabled={view.isImportAtCap || view.isImporting}
          onClick={view.onImport}
        >
          {view.isImporting ? 'Importing…' : 'Connect external'}
        </PixelButton>
        <ImportKeySheet disabled={view.isImportAtCap} />
        {view.isImportAtCap && (
          <span data-testid="wallet-import-hint" className={styles.importHint}>
            {view.importHint}
          </span>
        )}
      </div>
    </section>
  )
}
