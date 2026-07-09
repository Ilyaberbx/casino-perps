import { BALANCE_UNAVAILABLE_DISPLAY } from '@/modules/agent-balance'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { AGENT_BALANCE_LABEL, TOP_UP_LABEL } from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SheetAgentBalanceProps } from './perp-suggestion-sheet.types'

/**
 * The persistent Agent Balance shown in the sheet at all times (slice 08), even
 * before an estimate is run. The displayed figure is reconciled by the sheet
 * hook: the live agent-balance reading before/while a quote is pending, the
 * estimate's quote-time `agentBalanceUsd` once a quote is ready. The existing
 * top-up affordance attaches here when the current/last ready estimate reports
 * an insufficient balance. Dumb — every value + handler comes from the hook's
 * reconciled `balance` view-model. Visual polish is slice 09.
 */
export function SheetAgentBalance({ balance }: SheetAgentBalanceProps) {
  return (
    <div
      className={styles.agentBalance}
      data-testid="sheet-agent-balance"
      data-venue={balance.scopedVenueId}
    >
      <div className={styles.agentBalanceRow}>
        <span className={styles.agentBalanceLabel}>{AGENT_BALANCE_LABEL}</span>
        {balance.isLoading ? (
          <span
            className={`${styles.mono} ${styles.balanceSkeleton}`}
            data-testid="sheet-agent-balance-loading"
            role="status"
            aria-label="Loading balance"
          />
        ) : (
          <span
            className={styles.mono}
            data-testid={balance.isError ? 'sheet-agent-balance-error' : 'sheet-agent-balance-value'}
          >
            {balance.isError ? BALANCE_UNAVAILABLE_DISPLAY : balance.display}
          </span>
        )}
      </div>
      {balance.showTopUp ? (
        <PixelButton variant="default" fullWidth onClick={balance.onTopUp}>
          {TOP_UP_LABEL}
        </PixelButton>
      ) : null}
    </div>
  )
}
