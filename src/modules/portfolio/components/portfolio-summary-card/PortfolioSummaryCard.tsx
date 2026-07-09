import styles from './portfolio-summary-card.module.css'
import type { PortfolioSummaryCardProps } from './portfolio-summary-card.types'
import type { PortfolioAccountScope, PortfolioWindow } from '../../../shared/domain'
import { usePortfolioSummaryCard } from './use-portfolio-summary-card'
import { SummaryRowItem } from './SummaryRowItem'
import { SegmentedControl } from '../../../shared/components/segmented-control'
import { IconSelect } from '../../../shared/components/icon-select'

export function PortfolioSummaryCard(props: PortfolioSummaryCardProps) {
  const {
    isSimple,
    isLoading,
    scope,
    window,
    scopeOptions,
    periodOptions,
    rows,
    onScopeSelect,
    onWindowSelect,
  } = usePortfolioSummaryCard(props)
  const { onScopeChange, onWindowChange } = props

  return (
    <section className={styles.root} aria-label="Portfolio summary">
      <div className={styles.header}>
        <div className={styles.switcherGroup}>
          <span className={styles.switcherLabel}>Accounts</span>
          {isSimple ? (
            <IconSelect
              options={scopeOptions}
              value={scope}
              onChange={onScopeSelect}
              ariaLabel="Accounts scope"
            />
          ) : (
            <SegmentedControl<PortfolioAccountScope>
              options={scopeOptions}
              value={scope}
              onChange={onScopeChange}
              ariaLabel="Accounts scope"
            />
          )}
        </div>
        <div className={styles.switcherGroup}>
          <span className={styles.switcherLabel}>Period</span>
          {isSimple ? (
            <IconSelect
              options={periodOptions}
              value={window}
              onChange={onWindowSelect}
              ariaLabel="Period selector"
            />
          ) : (
            <SegmentedControl<PortfolioWindow>
              options={periodOptions}
              value={window}
              onChange={onWindowChange}
              ariaLabel="Period selector"
            />
          )}
        </div>
      </div>

      <div className={styles.body}>
        {rows.map((row) => (
          <SummaryRowItem key={row.key} row={row} isLoading={isLoading} />
        ))}
      </div>
    </section>
  )
}
