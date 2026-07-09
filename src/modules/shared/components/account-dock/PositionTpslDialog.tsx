import { Modal } from '@/modules/shared/components/modal'
import { Sheet } from '@/modules/shared/components/Sheet'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { formatDockSymbol } from './account-dock.utils'
import { usePositionTpsl } from './use-position-tpsl'
import { PositionTpslInfoRows } from './PositionTpslInfoRows'
import { PositionTpslLegField } from './PositionTpslLegField'
import { PositionTpslAmountBlock } from './PositionTpslAmountBlock'
import { PositionTpslLimitBlock } from './PositionTpslLimitBlock'
import { PositionTpslOrdersTable } from './PositionTpslOrdersTable'
import styles from './account-dock.module.css'
import type { PositionTpslTab, PositionTpslDialogProps, PositionTpslPanelProps } from './position-tpsl.types'

const DIALOG_ARIA_LABEL = 'Position TP/SL'

const TAB_OPTIONS = [
  { value: 'create', label: 'Create' },
  { value: 'orders', label: 'Orders' },
] as const

export function PositionTpslDialog({
  position,
  restingOrders,
  isMobile,
  onClose,
  onSubmit,
  onCancelOrder,
}: PositionTpslDialogProps) {
  const isOpen = position !== null
  const body = isOpen ? (
    <PositionTpslPanel
      position={position}
      restingOrders={restingOrders}
      onClose={onClose}
      onSubmit={onSubmit}
      onCancelOrder={onCancelOrder}
    />
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

function PositionTpslPanel({
  position,
  restingOrders,
  onClose,
  onSubmit,
  onCancelOrder,
}: PositionTpslPanelProps) {
  const view = usePositionTpsl({ position, restingOrders, onSubmit, onCancelOrder, onClose })
  const displaySymbol = formatDockSymbol(position.symbol)
  const isCreate = view.activeTab === 'create'

  return (
    <div className={styles.dialogBody}>
      <PositionTpslInfoRows position={position} displaySymbol={displaySymbol} />
      {isCreate ? (
        <div className={styles.tpslCreatePanel}>
          <PositionTpslLegField
            legKind="takeProfit"
            priceLabel="TP Price"
            amountLabel="Gain"
            basis={view.takeProfit.basis}
            draft={view.takeProfit.draft}
            onPriceChange={(value) => view.setLegPrice('takeProfit', value)}
            onAmountChange={(value) => view.setLegAmount('takeProfit', value)}
            onBasisChange={(basis) => view.setLegBasis('takeProfit', basis)}
          />
          <PositionTpslLegField
            legKind="stopLoss"
            priceLabel="SL Price"
            amountLabel="Loss"
            basis={view.stopLoss.basis}
            draft={view.stopLoss.draft}
            onPriceChange={(value) => view.setLegPrice('stopLoss', value)}
            onAmountChange={(value) => view.setLegAmount('stopLoss', value)}
            onBasisChange={(basis) => view.setLegBasis('stopLoss', basis)}
          />
          <PositionTpslAmountBlock
            enabled={view.configureAmount}
            onEnabledChange={view.setConfigureAmount}
            baseAsset={displaySymbol}
            amountInput={view.amountInput}
            onAmountChange={view.setAmountInput}
            fraction={view.amountFraction}
            onFractionChange={view.setAmountFraction}
            onMax={view.setAmountToMax}
          />
          <PositionTpslLimitBlock
            enabled={view.limitPriceEnabled}
            onEnabledChange={view.setLimitPriceEnabled}
            value={view.limitPriceInput}
            onChange={view.setLimitPriceInput}
          />
          <PixelButton
            variant="accentFilled"
            size="md"
            fullWidth
            disabled={!view.canSubmit}
            aria-label="Create TP/SL orders"
            onClick={view.submit}
          >
            Create TP/SL Orders
          </PixelButton>
        </div>
      ) : (
        <PositionTpslOrdersTable rows={view.orderRows} onCancel={view.cancelOrder} />
      )}
      <SegmentedControl<PositionTpslTab>
        options={TAB_OPTIONS}
        value={view.activeTab}
        ariaLabel="Position TP/SL view"
        onChange={view.setActiveTab}
      />
    </div>
  )
}
