import { ArrowRightLeft } from 'lucide-react'
import styles from './balances-panel.module.css'
import { IconButton } from '@/modules/shared/components/icon-button'
import type { BalanceActionsCellProps } from './balance-actions-cell.types'

/**
 * Trailing per-row actions cell for the balances table. Renders a "Transfer"
 * button only when the row is transfer-eligible (`canTransfer` — USDC rows on a
 * connected, segregated account with the venue's `transfer` capability; see
 * ADR-0033 D-4 / slice 05). Otherwise the cell is empty so the affordance is
 * simply absent (the mode-3 "hide the affordance" idiom). Dumb: the gate and
 * the click→open handler are owned by `use-balances-panel`.
 */
export function BalanceActionsCell({ balance, canTransfer, onTransfer }: BalanceActionsCellProps) {
  if (!canTransfer(balance)) {
    return <td className={styles.actionsCell} />
  }

  return (
    <td className={styles.actionsCell}>
      <IconButton
        icon={ArrowRightLeft}
        tone="accent"
        elevated
        ariaLabel="Transfer"
        title="Transfer"
        onClick={() => onTransfer(balance)}
      />
    </td>
  )
}
