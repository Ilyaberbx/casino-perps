import styles from './portfolio-summary.module.css'
import type { PortfolioSummaryProps } from './portfolio-summary.types'
import { SummaryTile } from './SummaryTile'
import {
  formatCurrency,
  formatSignedCurrency,
  toneFromValue,
} from './portfolio-summary.utils'

export function PortfolioSummary({ snapshot }: PortfolioSummaryProps) {
  const accountValue = snapshot?.accountValue ?? null
  // PnL/Volume are window-keyed (ADR-0039). This legacy tile grid carries no
  // Period selector, so it pins the 24H bucket — the value it always showed
  // before the window-keyed change. The active surface is PortfolioSummaryCard,
  // which selects by its `window` prop.
  const pnl = snapshot?.pnl['24H'] ?? null
  const perpsPnl = snapshot?.perpsPnl ?? null
  const volume = snapshot?.volume['24H'] ?? null

  return (
    <div className={styles.grid} role="group" aria-label="Portfolio summary">
      <SummaryTile label="Account Value" value={formatCurrency(accountValue)} tone="neutral" />
      <SummaryTile label="PNL" value={formatSignedCurrency(pnl)} tone={toneFromValue(pnl)} />
      <SummaryTile
        label="Perps PNL"
        value={formatSignedCurrency(perpsPnl)}
        tone={toneFromValue(perpsPnl)}
      />
      <SummaryTile label="Volume" value={formatCurrency(volume)} tone="neutral" />
    </div>
  )
}
