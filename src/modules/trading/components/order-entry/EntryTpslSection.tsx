import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import { ProtectionLegRow } from './ProtectionLegRow'
import styles from './order-entry.module.css'
import type { EntryTpslSectionProps, ProtectionBasis } from './order-entry.types'

const BASIS_OPTIONS: ReadonlyArray<{
  value: ProtectionBasis
  label: string
  ariaLabel: string
}> = [
  { value: 'usd', label: '$', ariaLabel: 'Gain/loss in USD' },
  { value: 'percent', label: '%', ariaLabel: 'Gain/loss in percent' },
]

/** Entry-attached TP/SL section, redesigned to the reference 2×2 grid: a section
 *  checkbox, a `$ / %` toggle on the header (switches the Gain/Loss column
 *  between absolute USD and % ROI), then two coupled rows — `[TP Price | Gain]`
 *  and `[SL Price | Loss]`. Rendered only for market/limit when the venue
 *  accepts trigger orders (gating owned by the hook). Price↔gain/loss coupling
 *  and $/% reprojection live in the hook + `entry-protection.utils`. */
export function EntryTpslSection({
  protection,
  onEnabledChange,
  onBasisChange,
  onLegPriceChange,
  onLegAmountChange,
}: EntryTpslSectionProps) {
  return (
    <div className={styles.tpslSection}>
      <div className={styles.tpslHeader}>
        <PixelCheckbox
          checked={protection.enabled}
          onChange={onEnabledChange}
          label="Take profit / Stop loss"
        />
        {protection.enabled ? (
          <SegmentedControl<ProtectionBasis>
            options={BASIS_OPTIONS}
            value={protection.basis}
            ariaLabel="Gain/loss basis"
            onChange={onBasisChange}
          />
        ) : null}
      </div>
      {protection.enabled ? (
        <div className={styles.tpslGrid}>
          <ProtectionLegRow
            legKind="takeProfit"
            priceLabel="TP Price"
            amountLabel="Gain"
            basis={protection.basis}
            draft={protection.takeProfit}
            onPriceChange={(value) => onLegPriceChange('takeProfit', value)}
            onAmountChange={(value) => onLegAmountChange('takeProfit', value)}
          />
          <ProtectionLegRow
            legKind="stopLoss"
            priceLabel="SL Price"
            amountLabel="Loss"
            basis={protection.basis}
            draft={protection.stopLoss}
            onPriceChange={(value) => onLegPriceChange('stopLoss', value)}
            onAmountChange={(value) => onLegAmountChange('stopLoss', value)}
          />
        </div>
      ) : null}
    </div>
  )
}
