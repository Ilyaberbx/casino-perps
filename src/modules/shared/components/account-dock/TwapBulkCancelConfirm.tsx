import { Modal } from '@/modules/shared/components/modal'
import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './account-dock.module.css'
import type { TwapBulkCancelConfirmProps } from './twap-panel.types'

const TITLE = 'Cancel TWAP orders'

/** Confirm for the bulk Cancel(N) action over selected active TWAPs — mirrors
 *  `BulkActionConfirm`: single cancels never confirm, bulk always does. */
export function TwapBulkCancelConfirm({
  isOpen,
  isMobile,
  count,
  onConfirm,
  onCancel,
}: TwapBulkCancelConfirmProps) {
  const body = (
    <div className={styles.dialogBody}>
      <p className={styles.dialogSymbol}>{`Cancel ${count} selected TWAP order${count === 1 ? '' : 's'}?`}</p>
      <div className={styles.dialogActions}>
        <PixelButton variant="default" size="md" aria-label="Keep" onClick={onCancel}>
          Keep
        </PixelButton>
        <PixelButton
          variant="directionDown"
          size="md"
          aria-label={`Cancel ${count} TWAP orders`}
          onClick={onConfirm}
        >
          {`Cancel (${count})`}
        </PixelButton>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet isOpen={isOpen} onClose={onCancel} side="bottom" ariaLabel={TITLE}>
        <h2 className={styles.dialogTitle}>{TITLE}</h2>
        {body}
      </Sheet>
    )
  }
  return (
    <Modal isOpen={isOpen} onClose={onCancel} ariaLabel={TITLE} title={TITLE}>
      {body}
    </Modal>
  )
}
