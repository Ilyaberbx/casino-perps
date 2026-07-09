import type { ReactNode } from 'react'
import type { EquityExtensionBucket, MarginSummarySnapshot } from '@/modules/shared/domain'
import type { ManageFundsTab } from '@/modules/shared/providers/manage-funds-provider'

/** How a row's numeric value is rendered. */
export type RowFormat = 'usd' | 'signedUsd' | 'leverage'

/** Directional color for a value (PnL up/down); never the sole carrier of meaning. */
export type RowTone = 'up' | 'down' | 'neutral'

/** Margin Ratio health band → badge color. */
export type MarginRatioBand = 'safe' | 'caution' | 'danger'

/**
 * One row in the equity breakdown. `value` is the Venue-supplied scalar (null →
 * render the placeholder dash). `muted` marks the indented, dimmed sub-group
 * (Unrealized PNL / Maintenance Margin / Account Leverage). `format` selects the
 * display; `tone` colors a signed value.
 */
export interface EquityCardRow {
  readonly key: string
  readonly label: string
  readonly value: number | null
  readonly muted?: boolean
  readonly format?: RowFormat
  readonly tone?: RowTone
  /** Plain-copy tooltip on the label (the leverage row's rich tooltip is wired in the view). */
  readonly tooltip?: string
}

/** The Account Leverage `(a)/(b)` tooltip breakdown, labels flipped by mode. */
export interface LeverageBreakdown {
  readonly aLabel: string
  readonly aValue: number | null
  readonly bLabel: string
  readonly bValue: number | null
  readonly resultLabel: string
  readonly resultValue: number | null
}

/** A curated Manage-Funds deep link rendered as a card button. */
export interface FundingAction {
  readonly tab: ManageFundsTab
  readonly label: string
}

export interface TradeEquityCardContent {
  readonly isConnected: boolean
  readonly isLoading: boolean
  readonly totalEquity: number | null
  /** Account-health %, drives the badge. `null` → no badge (no data). */
  readonly marginRatioPct: number | null
  readonly rows: ReadonlyArray<EquityCardRow>
  readonly leverageBreakdown: LeverageBreakdown
  readonly fundingActions: ReadonlyArray<FundingAction>
  /** Mobile: the breakdown collapses behind a toggle to save vertical space. */
  readonly isCollapsible: boolean
  readonly isExpanded: boolean
  readonly rowsVisible: boolean
  toggleExpanded(): void
  onOpenFunds(tab: ManageFundsTab): void
}

export interface BuildEquityRowsInput {
  readonly isSegregated: boolean
  readonly isConnected: boolean
  readonly spotEquity: number | null
  readonly perpsEquity: number | null
  readonly buckets: ReadonlyArray<EquityExtensionBucket>
  readonly margin: MarginSummarySnapshot | null
}

export interface EquityCardRowProps {
  readonly label: string
  readonly value: number | null
  readonly isLoading: boolean
  readonly muted?: boolean
  readonly format?: RowFormat
  readonly tone?: RowTone
  /** When present, the label becomes a dotted-underline InfoTooltip trigger. */
  readonly tooltip?: ReactNode
}

export interface LeverageTooltipContentProps {
  readonly breakdown: LeverageBreakdown
}

export interface EquityRowValueProps {
  readonly value: number | null
  readonly isLoading: boolean
  readonly format?: RowFormat
}

export interface MarginRatioBadgeProps {
  readonly pct: number | null
}
