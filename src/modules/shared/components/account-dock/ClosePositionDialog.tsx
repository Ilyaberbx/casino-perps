import { Modal } from '@/modules/shared/components/modal'
import { Sheet } from '@/modules/shared/components/Sheet'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { formatTokenAmount } from '@/modules/shared/utils/format-number'
import { formatDockSymbol } from './account-dock.utils'
import { useClosePositionDialog } from './use-close-position-dialog'
import styles from './account-dock.module.css'
import type {
  CloseKind,
  CloseSizeBasis,
  ClosePositionDialogProps,
  ClosePositionFormProps,
} from './account-dock.types'

const DIALOG_ARIA_LABEL = 'Close position'

const KIND_OPTIONS = [
  { value: 'partial', label: 'Market' },
  { value: 'limit', label: 'Limit' },
] as const

const BASIS_OPTIONS = [
  { value: 'percent', label: '%' },
  { value: 'coin', label: 'Coin' },
] as const

export function ClosePositionDialog({
  position,
  isMobile,
  onClose,
  onSubmit,
}: ClosePositionDialogProps) {
  const isOpen = position !== null
  const body = isOpen ? (
    <ClosePositionForm position={position} onClose={onClose} onSubmit={onSubmit} />
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

function ClosePositionForm({ position, onClose, onSubmit }: ClosePositionFormProps) {
  const {
    kind,
    sizeBasis,
    sizeInput,
    priceInput,
    resolvedSize,
    canSubmit,
    setKind,
    setSizeBasis,
    setSizeInput,
    setPriceInput,
    submit,
  } = useClosePositionDialog({ position, onSubmit, onClose })

  const sideLabel = position.side === 'long' ? 'Long' : 'Short'
  const displaySymbol = formatDockSymbol(position.symbol)
  return (
    <div className={styles.dialogBody}>
      <p className={styles.dialogSymbol}>
        {displaySymbol} · {sideLabel} {formatTokenAmount(Math.abs(position.size))}
      </p>
      <SegmentedControl<CloseKind>
        options={KIND_OPTIONS}
        value={kind}
        ariaLabel="Close type"
        onChange={setKind}
      />
      <label className={styles.dialogField}>
        <span className={styles.dialogLabel}>Close size</span>
        <div className={styles.dialogSizeRow}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.dialogInput}
            value={sizeInput}
            aria-label="Close size"
            onChange={(event) => setSizeInput(event.target.value)}
          />
          <SegmentedControl<CloseSizeBasis>
            options={BASIS_OPTIONS}
            value={sizeBasis}
            ariaLabel="Close size basis"
            onChange={setSizeBasis}
          />
        </div>
        <span className={styles.dialogHint}>
          Closing {formatTokenAmount(resolvedSize)} {displaySymbol}
        </span>
      </label>
      {kind === 'limit' ? (
        <label className={styles.dialogField}>
          <span className={styles.dialogLabel}>Limit price</span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.dialogInput}
            value={priceInput}
            aria-label="Limit close price"
            onChange={(event) => setPriceInput(event.target.value)}
          />
        </label>
      ) : null}
      <PixelButton
        variant="directionDown"
        size="md"
        fullWidth
        disabled={!canSubmit}
        aria-label="Submit close"
        onClick={submit}
      >
        Close {sideLabel}
      </PixelButton>
    </div>
  )
}
