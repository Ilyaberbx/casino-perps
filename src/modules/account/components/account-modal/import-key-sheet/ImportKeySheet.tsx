import { ShieldCheck } from 'lucide-react'
import { Modal } from '@/modules/shared/components/modal'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { useImportKeySheet } from './use-import-key-sheet'
import type { ImportKeySheetProps } from './import-key-sheet.types'
import styles from './import-key-sheet.module.css'

/**
 * Raw private-key import affordance (ADR-0076 D-6): a trigger button beside the
 * Wallets section's "Connect external" button, plus the secret-entry surface.
 * The key is entered in a **masked** input inside the shared `Modal` (a true
 * dialog — the right surface for secret entry, not the non-modal Sheet). All
 * state + the import pipeline live in `useImportKeySheet`; this component is dumb.
 */
export function ImportKeySheet({ disabled = false }: ImportKeySheetProps) {
  const view = useImportKeySheet()

  return (
    <>
      <PixelButton
        type="button"
        variant="default"
        data-testid="import-key-open"
        disabled={disabled}
        onClick={view.open}
      >
        Import private key
      </PixelButton>

      <Modal
        isOpen={view.isOpen}
        onClose={view.close}
        ariaLabel="Import private key"
        title="Import private key"
        size="sm"
      >
        <div className={styles.body}>
          <div className={styles.callout}>
            <ShieldCheck size={16} className={styles.calloutIcon} aria-hidden="true" />
            <p className={styles.calloutText}>
              Paste a wallet's private key (64 hex characters). It is sent straight to Privy's secure
              enclave and added as an exportable wallet — we never store or see it.
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor="import-key-input" className={styles.label}>
              Private key
            </label>
            <input
              id="import-key-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className={view.error !== null ? `${styles.input} ${styles.inputInvalid}` : styles.input}
              placeholder="0x…"
              data-testid="import-key-input"
              value={view.keyInput}
              onChange={(e) => view.setKeyInput(e.target.value)}
            />
          </div>
          {view.error !== null && (
            <p role="alert" className={styles.error}>
              {view.error}
            </p>
          )}
          <PixelButton
            type="button"
            variant="accent"
            fullWidth
            data-testid="import-key-submit"
            disabled={!view.isValid || view.isSubmitting}
            onClick={view.onSubmit}
          >
            {view.isSubmitting ? 'Importing…' : 'Import wallet'}
          </PixelButton>
        </div>
      </Modal>
    </>
  )
}
