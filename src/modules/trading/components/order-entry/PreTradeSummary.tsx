import { formatTokenAmount, formatUsd } from '@/modules/shared/utils/format-number'
import styles from './order-entry.module.css'
import type {
  LinearPreTradeEstimates,
  PreTradeSummaryProps,
  SlippageControl,
  TwapPreTradeEstimates,
} from './order-entry.types'

export function PreTradeSummary({ estimates, slippage, showLiquidation }: PreTradeSummaryProps) {
  return (
    <dl className={styles.summary} aria-label="Pre-trade estimates">
      {estimates.kind === 'twap' ? (
        <TwapRows estimates={estimates} />
      ) : (
        <LinearRows estimates={estimates} slippage={slippage} showLiquidation={showLiquidation} />
      )}
    </dl>
  )
}

function LinearRows({
  estimates,
  slippage,
  showLiquidation,
}: {
  estimates: LinearPreTradeEstimates
  slippage: SlippageControl | null
  showLiquidation: boolean
}) {
  // The Liquidation Price row is shown for perp/HIP-3 market orders ($0.00 when
  // flat) and never for limit/stop or on spot (no liquidation) — the caller owns
  // that decision via `showLiquidation`.
  return (
    <>
      {showLiquidation ? (
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Liquidation Price</dt>
          <dd className={styles.summaryValue}>{formatUsd(estimates.liquidationPrice)}</dd>
        </div>
      ) : null}
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Order Value</dt>
        <dd className={styles.summaryValue}>{formatUsd(estimates.notional)}</dd>
      </div>
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Margin Required</dt>
        <dd className={styles.summaryValue}>{formatUsd(estimates.margin)}</dd>
      </div>
      {slippage ? <SlippageRow slippage={slippage} /> : null}
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Fees</dt>
        <dd className={styles.summaryValue}>{formatUsd(estimates.fee)}</dd>
      </div>
    </>
  )
}

function TwapRows({ estimates }: { estimates: TwapPreTradeEstimates }) {
  return (
    <>
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Frequency</dt>
        <dd className={styles.summaryValue}>{estimates.frequencySeconds} Seconds</dd>
      </div>
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Runtime</dt>
        <dd className={styles.summaryValue}>{estimates.runtimeMinutes}m</dd>
      </div>
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}># Orders</dt>
        <dd className={styles.summaryValue}>{estimates.numberOfOrders}</dd>
      </div>
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Size per Suborder</dt>
        <dd className={styles.summaryValue}>{formatTokenAmount(estimates.sizePerSuborder)}</dd>
      </div>
      <div className={styles.summaryRow}>
        <dt className={styles.summaryLabel}>Fees</dt>
        <dd className={styles.summaryValue}>{formatUsd(estimates.fee)}</dd>
      </div>
    </>
  )
}

function SlippageRow({ slippage }: { slippage: SlippageControl }) {
  return (
    <div className={styles.summaryRow}>
      <dt className={styles.summaryLabel}>Slippage</dt>
      <dd className={styles.summaryValue}>
        <span className={styles.slippageField}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.slippageInput}
            value={slippage.value}
            placeholder="Auto"
            aria-label="Slippage tolerance percent"
            onChange={(event) => slippage.onChange(event.target.value)}
          />
          <span aria-hidden="true">%</span>
        </span>
      </dd>
    </div>
  )
}
