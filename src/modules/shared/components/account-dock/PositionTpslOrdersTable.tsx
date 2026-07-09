import { PixelButton } from '@/modules/shared/components/pixel-button'
import { formatTokenAmount, formatUsd } from '@/modules/shared/utils/format-number'
import styles from './account-dock.module.css'
import type { PositionTpslOrdersTableProps } from './position-tpsl.types'

export function PositionTpslOrdersTable({ rows, onCancel }: PositionTpslOrdersTableProps) {
  if (rows.length === 0) {
    return <p className={styles.tpslOrdersEmpty}>No TP/SL orders found</p>
  }
  return (
    <table className={styles.tpslOrdersTable}>
      <thead>
        <tr>
          <th>Type</th>
          <th>Trigger Price</th>
          <th>Price</th>
          <th>Size</th>
          <th>Expected PNL</th>
          <th aria-label="Cancel" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.identifier}>
            <td>{row.typeLabel}</td>
            <td>{formatTokenAmount(row.triggerPrice)}</td>
            <td>{formatTokenAmount(row.price)}</td>
            <td>{formatTokenAmount(Math.abs(row.size))}</td>
            <td>{formatUsd(row.expectedPnlUsd, { signed: true })}</td>
            <td>
              <PixelButton
                variant="default"
                size="sm"
                aria-label={`Cancel ${row.typeLabel} order`}
                onClick={() => onCancel(row.identifier)}
              >
                Cancel
              </PixelButton>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
