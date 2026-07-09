import styles from './order-entry.module.css'
import type { ProtectionLegRowProps } from './order-entry.types'

/** One row of the TP/SL 2×2 grid — a Price cell and a coupled Gain/Loss cell.
 *  The Gain/Loss cell carries a `$`/`%` suffix per the section's active basis.
 *  Dumb: it forwards raw input strings; the hook owns the price↔amount coupling
 *  derivation, so this component never computes a value. */
export function ProtectionLegRow({
  priceLabel,
  amountLabel,
  basis,
  draft,
  onPriceChange,
  onAmountChange,
}: ProtectionLegRowProps) {
  const amountSuffix = basis === 'percent' ? '%' : '$'
  const amountUnitWord = basis === 'percent' ? 'percent' : 'amount'
  return (
    <div className={styles.tpslRow}>
      <input
        type="text"
        inputMode="decimal"
        className={styles.tpslPriceInput}
        value={draft.priceInput}
        placeholder={priceLabel}
        aria-label={`${priceLabel}`}
        onChange={(event) => onPriceChange(event.target.value)}
      />
      <div className={styles.tpslAmountCell}>
        <input
          type="text"
          inputMode="decimal"
          className={styles.tpslAmountInput}
          value={draft.amountInput}
          placeholder={amountLabel}
          aria-label={`${amountLabel} ${amountUnitWord}`}
          onChange={(event) => onAmountChange(event.target.value)}
        />
        <span className={styles.tpslAmountSuffix}>{amountSuffix}</span>
      </div>
    </div>
  )
}
