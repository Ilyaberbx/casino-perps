import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import styles from './account-dock.module.css'
import type { ProtectionBasis } from '@/modules/shared/utils/protection-coupling.types'
import type { PositionTpslLegFieldProps } from './position-tpsl.types'

const BASIS_OPTIONS = [
  { value: 'usd', label: '$' },
  { value: 'percent', label: '%' },
] as const

export function PositionTpslLegField({
  legKind,
  priceLabel,
  amountLabel,
  basis,
  draft,
  onPriceChange,
  onAmountChange,
  onBasisChange,
}: PositionTpslLegFieldProps) {
  const isTakeProfit = legKind === 'takeProfit'
  const gainLossWord = isTakeProfit ? 'gain' : 'loss'
  return (
    <div className={styles.tpslLegRow}>
      <label className={styles.dialogField}>
        <span className={styles.dialogLabel}>{priceLabel}</span>
        <input
          type="text"
          inputMode="decimal"
          className={styles.dialogInput}
          value={draft.priceInput}
          aria-label={priceLabel}
          onChange={(event) => onPriceChange(event.target.value)}
        />
      </label>
      <label className={styles.dialogField}>
        <span className={styles.dialogLabel}>{amountLabel}</span>
        <div className={styles.dialogSizeRow}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.dialogInput}
            value={draft.amountInput}
            aria-label={`${amountLabel} ${gainLossWord} ${basis === 'percent' ? 'percent' : 'dollars'}`}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <SegmentedControl<ProtectionBasis>
            options={BASIS_OPTIONS}
            value={basis}
            ariaLabel={`${amountLabel} basis`}
            onChange={onBasisChange}
          />
        </div>
      </label>
    </div>
  )
}
