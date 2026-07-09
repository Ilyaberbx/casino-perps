import { StatRow } from '../../../shared/components/stat-row'
import { ValueSkeleton } from '../../../shared/components/value-skeleton'
import { formatCurrency, formatSignedCurrency } from '../portfolio-summary/portfolio-summary.utils'
import { EQUITY_PLACEHOLDER } from './portfolio-summary-card.constants'
import type { SummaryRowItemProps } from './portfolio-summary-card.types'

/**
 * One dumb Account Equity row (#275). A `placeholder` row (Max Drawdown) always
 * shows the dim dash — the facet is Venue-unsupplied and never app-computed. A
 * value row shows a skeleton while loading, otherwise the formatted currency.
 */
export function SummaryRowItem({ row, isLoading }: SummaryRowItemProps) {
  if (row.format === 'placeholder') {
    return <StatRow label={row.label} value={EQUITY_PLACEHOLDER} tone="muted" />
  }

  if (isLoading) {
    return (
      <StatRow
        label={row.label}
        value={<ValueSkeleton ariaLabel={`Loading ${row.label}`} width={88} />}
      />
    )
  }

  const isSigned = row.format === 'signedCurrency'
  const display = isSigned ? formatSignedCurrency(row.value) : formatCurrency(row.value)
  return <StatRow label={row.label} value={display} />
}
