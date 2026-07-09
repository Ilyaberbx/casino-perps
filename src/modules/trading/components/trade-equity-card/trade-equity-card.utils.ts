import type { MarginSummarySnapshot } from '@/modules/shared/domain'
import type {
  BuildEquityRowsInput,
  EquityCardRow,
  LeverageBreakdown,
  MarginRatioBand,
  RowTone,
} from './trade-equity-card.types'
import {
  ACCOUNT_LEVERAGE_LABEL,
  LEVERAGE_BREAKDOWN_LABELS,
  MAINTENANCE_MARGIN_LABEL,
  MAINTENANCE_MARGIN_TOOLTIP,
  MARGIN_RATIO_CAUTION_PCT,
  MARGIN_RATIO_DANGER_PCT,
  PERPS_TOOLTIP,
  PERP_BUCKET_LABEL,
  SIMPLE_EQUITY_ROW_KEYS,
  SPOT_LABEL,
  UNREALIZED_PNL_LABEL,
} from './trade-equity-card.constants'

/**
 * Collapse a zero (or absent) value to `null` so the row renders the dash
 * instead of `$0.00` — matching the reference, which shows `—` for empty
 * buckets (Spot / Earn / Staking) rather than a zero amount.
 */
export function nonZeroOrNull(value: number | null): number | null {
  if (value === null) return null
  if (value === 0) return null
  return value
}

export function signedTone(value: number | null): RowTone {
  if (value === null || value === 0) return 'neutral'
  if (value > 0) return 'up'
  return 'down'
}

/**
 * Unified Trading Equity = available spot + all-dexs perp equity, shown ex-uPnL.
 * Both inputs may be null (no snapshot yet) → null (renders `—`). When either is
 * present, the absent one counts as 0. `upnlOffset` is subtracted once because the
 * perp-equity term already includes unrealized PnL (spot does not).
 */
export function combineUnifiedTradingExUpnl(
  spotEquity: number | null,
  perpsEquity: number | null,
  upnlOffset: number,
): number | null {
  if (spotEquity === null && perpsEquity === null) return null
  return (spotEquity ?? 0) + (perpsEquity ?? 0) - upnlOffset
}

export function formatLeverage(value: number): string {
  return `${value.toFixed(2)}x`
}

export function formatMarginRatio(value: number): string {
  return `${value.toFixed(2)}%`
}

/** Map a Margin Ratio percent to its health band (badge color). */
export function marginRatioBand(pct: number): MarginRatioBand {
  if (pct >= MARGIN_RATIO_DANGER_PCT) return 'danger'
  if (pct >= MARGIN_RATIO_CAUTION_PCT) return 'caution'
  return 'safe'
}

/**
 * Build the mode-polymorphic equity breakdown. Segregated splits Spot + Perps
 * (the perp bucket shown **ex-unrealized-PnL**, with uPnL broken out below per
 * ADR-0072); unified collapses to a single Trading Equity pool. The derived
 * sub-group (uPnL / Maintenance Margin / Account Leverage) reads from the margin
 * snapshot — `null` (unified / unavailable) renders as `—`. Vault / Earn /
 * Staking buckets follow.
 */
export function buildEquityRows(input: BuildEquityRowsInput): ReadonlyArray<EquityCardRow> {
  const { isSegregated, isConnected, spotEquity, perpsEquity, buckets, margin } = input

  const unrealizedPnl = margin?.unrealizedPnlUsd ?? null
  const upnlOffset = unrealizedPnl ?? 0
  const perpsExUpnl = perpsEquity === null ? null : perpsEquity - upnlOffset
  // Unified collapses spot + (all-dexs) perp equity into one Trading Equity bucket,
  // shown ex-uPnL like the segregated Perps row (perp equity carries uPnL; spot
  // does not, so subtract once). `spotEquity` is the hold-netted available spot.
  const unifiedTradingExUpnl = combineUnifiedTradingExUpnl(spotEquity, perpsEquity, upnlOffset)

  const primaryRows: ReadonlyArray<EquityCardRow> = isSegregated
    ? [
        { key: 'spot', label: SPOT_LABEL, value: nonZeroOrNull(spotEquity), format: 'usd' },
        {
          key: 'perps',
          label: PERP_BUCKET_LABEL.segregated,
          value: nonZeroOrNull(perpsExUpnl),
          format: 'usd',
          tooltip: PERPS_TOOLTIP,
        },
      ]
    : [
        {
          key: 'trading',
          label: PERP_BUCKET_LABEL.unified,
          value: nonZeroOrNull(unifiedTradingExUpnl),
          format: 'usd',
        },
      ]

  const maintenanceLabel = isSegregated
    ? MAINTENANCE_MARGIN_LABEL.segregated
    : MAINTENANCE_MARGIN_LABEL.unified
  const leverageLabel = isSegregated
    ? ACCOUNT_LEVERAGE_LABEL.segregated
    : ACCOUNT_LEVERAGE_LABEL.unified

  const derivedRows: ReadonlyArray<EquityCardRow> = [
    {
      key: 'unrealizedPnl',
      label: UNREALIZED_PNL_LABEL,
      value: unrealizedPnl,
      muted: true,
      format: 'signedUsd',
      tone: signedTone(unrealizedPnl),
    },
    {
      key: 'maintenanceMargin',
      label: maintenanceLabel,
      value: margin?.maintenanceMarginUsd ?? null,
      muted: true,
      format: 'usd',
      tooltip: MAINTENANCE_MARGIN_TOOLTIP,
    },
    {
      key: 'accountLeverage',
      label: leverageLabel,
      value: margin?.accountLeverage ?? null,
      muted: true,
      format: 'leverage',
    },
  ]

  const bucketRows: ReadonlyArray<EquityCardRow> = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: isConnected ? nonZeroOrNull(bucket.amountUsd) : null,
    format: 'usd',
  }))

  return [...primaryRows, ...derivedRows, ...bucketRows]
}

/**
 * Keep only the rows the Simple-mode card shows (#278): Spot, Perps / Trading
 * Equity, and Unrealized PNL. Maintenance Margin, Cross Account Leverage, and
 * the Vault / Earn / Staking buckets are dropped. Pro mode passes the full list
 * through unchanged at the call site.
 */
export function filterSimpleEquityRows(
  rows: ReadonlyArray<EquityCardRow>,
): ReadonlyArray<EquityCardRow> {
  return rows.filter((row) => SIMPLE_EQUITY_ROW_KEYS.includes(row.key))
}

/** The Account Leverage `(a)/(b)` tooltip breakdown, labels flipped by mode. */
export function buildLeverageBreakdown(
  margin: MarginSummarySnapshot | null,
  isSegregated: boolean,
): LeverageBreakdown {
  const labels = isSegregated ? LEVERAGE_BREAKDOWN_LABELS.segregated : LEVERAGE_BREAKDOWN_LABELS.unified
  return {
    aLabel: labels.a,
    aValue: margin?.totalCrossPositionsValueUsd ?? null,
    bLabel: labels.b,
    bValue: margin?.crossAccountValueUsd ?? null,
    resultLabel: labels.result,
    resultValue: margin?.accountLeverage ?? null,
  }
}
