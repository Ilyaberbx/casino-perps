import { ChevronDown } from 'lucide-react'
import { ConnectWalletGateButton } from '@/modules/account'
import { InfoTooltip } from '@/modules/shared/components/info-tooltip'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { ValueSkeleton } from '@/modules/shared/components/value-skeleton'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { EquityCardRow } from './EquityCardRow'
import { LeverageTooltipContent } from './LeverageTooltipContent'
import { MarginRatioBadge } from './MarginRatioBadge'
import { useTradeEquityCard } from './use-trade-equity-card'
import { TOTAL_EQUITY_LABEL, TOTAL_EQUITY_TOOLTIP } from './trade-equity-card.constants'
import styles from './trade-equity-card.module.css'

/**
 * The Trade-page right-rail equity card (ADR-0072) — Total Equity headline,
 * Deposit/Transfer/Withdraw deep links, and the mode-polymorphic breakdown
 * (Spot/Perps vs Trading Equity → derived sub-group → Vault/Earn/Staking).
 * The health badge and the derived-row values land in a later slice.
 */
export function TradeEquityCard() {
  const {
    isLoading,
    totalEquity,
    marginRatioPct,
    rows,
    leverageBreakdown,
    fundingActions,
    isCollapsible,
    isExpanded,
    rowsVisible,
    toggleExpanded,
    onOpenFunds,
  } = useTradeEquityCard()

  const hasFunding = fundingActions.length > 0

  return (
    <section className={styles.root} aria-label="Account equity">
      <div className={styles.header}>
        <span className={styles.headerLabel}>
          <InfoTooltip label={TOTAL_EQUITY_LABEL} content={TOTAL_EQUITY_TOOLTIP} />
        </span>
        <div className={styles.headerRight}>
          <MarginRatioBadge pct={marginRatioPct} />
          {isCollapsible ? (
            <button
              type="button"
              className={styles.toggle}
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              aria-controls="trade-equity-rows"
              aria-label={isExpanded ? 'Hide account details' : 'Show account details'}
            >
              <ChevronDown
                size={16}
                className={isExpanded ? styles.toggleIconOpen : styles.toggleIcon}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.headline}>
        {isLoading ? (
          <ValueSkeleton ariaLabel="Loading total equity" width={120} height={26} />
        ) : (
          formatUsd(totalEquity ?? 0)
        )}
      </div>

      {hasFunding ? (
        <ConnectWalletGateButton>
          <div className={styles.funding} role="group" aria-label="Manage funds">
            {fundingActions.map((action) => (
              <PixelButton
                key={action.tab}
                type="button"
                variant="default"
                size="sm"
                elevated
                onClick={() => onOpenFunds(action.tab)}
              >
                {action.label}
              </PixelButton>
            ))}
          </div>
        </ConnectWalletGateButton>
      ) : null}

      {rowsVisible ? (
        <div className={styles.rows} id="trade-equity-rows">
          {rows.map((row) => (
            <EquityCardRow
              key={row.key}
              label={row.label}
              value={row.value}
              isLoading={isLoading}
              muted={row.muted}
              format={row.format}
              tone={row.tone}
              tooltip={
                row.key === 'accountLeverage' ? (
                  <LeverageTooltipContent breakdown={leverageBreakdown} />
                ) : (
                  row.tooltip
                )
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
