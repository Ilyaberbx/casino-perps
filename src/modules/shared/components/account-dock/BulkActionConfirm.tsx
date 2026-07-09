import { Modal } from '@/modules/shared/components/modal'
import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { bulkActionConfirmLabel, bulkActionPrompt, bulkActionTitle } from './bulk-action.utils'
import styles from './account-dock.module.css'
import type { BulkActionConfirmProps } from './account-dock.types'

/** Lightweight confirm for Cancel-all / Close-all (the only destructive bulk
 *  actions). Single actions never confirm; bulk always does (PRD). */
export function BulkActionConfirm({
  action,
  isMobile,
  count,
  onConfirm,
  onCancel,
}: BulkActionConfirmProps) {
  const isOpen = action !== null
  const title = action !== null ? bulkActionTitle(action) : ''
  const body =
    action !== null ? (
      <div className={styles.dialogBody}>
        <p className={styles.dialogSymbol}>{bulkActionPrompt(action, count)}</p>
        <div className={styles.dialogActions}>
          <PixelButton variant="default" size="md" aria-label="Keep" onClick={onCancel}>
            Keep
          </PixelButton>
          <PixelButton
            variant="directionDown"
            size="md"
            aria-label={bulkActionConfirmLabel(action)}
            onClick={onConfirm}
          >
            {bulkActionConfirmLabel(action)}
          </PixelButton>
        </div>
      </div>
    ) : null

  if (isMobile) {
    return (
      <Sheet isOpen={isOpen} onClose={onCancel} side="bottom" ariaLabel={title || 'Bulk action'}>
        <h2 className={styles.dialogTitle}>{title}</h2>
        {body}
      </Sheet>
    )
  }
  return (
    <Modal isOpen={isOpen} onClose={onCancel} ariaLabel={title || 'Bulk action'} title={title}>
      {body}
    </Modal>
  )
}
