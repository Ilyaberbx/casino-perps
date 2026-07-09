import { Modal } from '@/modules/shared/components/modal'
import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { useModifyOrderDialog } from './use-modify-order-dialog'
import { directionLabel } from './account-dock.utils'
import styles from './account-dock.module.css'
import type { ModifyOrderDialogProps, ModifyOrderFormProps } from './account-dock.types'

const DIALOG_ARIA_LABEL = 'Modify order'

export function ModifyOrderDialog({ order, isMobile, onClose, onSubmit }: ModifyOrderDialogProps) {
  const isOpen = order !== null
  const body = isOpen ? (
    <ModifyOrderForm order={order} onClose={onClose} onSubmit={onSubmit} />
  ) : null

  if (isMobile) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} side="bottom" ariaLabel={DIALOG_ARIA_LABEL}>
        <h2 className={styles.dialogTitle}>{DIALOG_ARIA_LABEL}</h2>
        {body}
      </Sheet>
    )
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={DIALOG_ARIA_LABEL} title={DIALOG_ARIA_LABEL}>
      {body}
    </Modal>
  )
}

function ModifyOrderForm({ order, onClose, onSubmit }: ModifyOrderFormProps) {
  const { priceInput, sizeInput, canSubmit, setPriceInput, setSizeInput, submit } =
    useModifyOrderDialog({ order, onSubmit, onClose })

  return (
    <div className={styles.dialogBody}>
      <p className={styles.dialogSymbol}>
        {order.symbol} · {directionLabel(order.side)}
      </p>
      <label className={styles.dialogField}>
        <span className={styles.dialogLabel}>Price</span>
        <input
          type="text"
          inputMode="decimal"
          className={styles.dialogInput}
          value={priceInput}
          aria-label="Order price"
          onChange={(event) => setPriceInput(event.target.value)}
        />
      </label>
      <label className={styles.dialogField}>
        <span className={styles.dialogLabel}>Size</span>
        <input
          type="text"
          inputMode="decimal"
          className={styles.dialogInput}
          value={sizeInput}
          aria-label="Order size"
          onChange={(event) => setSizeInput(event.target.value)}
        />
      </label>
      <PixelButton
        variant="accentFilled"
        size="md"
        fullWidth
        disabled={!canSubmit}
        aria-label="Save order changes"
        onClick={submit}
      >
        Save
      </PixelButton>
    </div>
  )
}
