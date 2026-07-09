import { useIsSimpleMode } from '../../../shared/providers/trading-mode-provider'
import type { PortfolioAccountScope, PortfolioWindow } from '../../../shared/domain'
import { PERIOD_OPTIONS, SUMMARY_ROW_LABELS } from './portfolio-summary-card.constants'
import { visibleScopeOptions } from './portfolio-summary-card.utils'
import type {
  PortfolioSummaryCardContent,
  PortfolioSummaryCardProps,
  SummaryRow,
} from './portfolio-summary-card.types'

function isPortfolioWindow(value: string): value is PortfolioWindow {
  return PERIOD_OPTIONS.some((option) => option.value === value)
}

function isPortfolioAccountScope(value: string): value is PortfolioAccountScope {
  return value === 'all' || value === 'perps'
}

/**
 * Smart hook for `<PortfolioSummaryCard>`. Owns the Pro/Simple control-style
 * resolution (`useIsSimpleMode`, #276) and builds the restyled Account Equity
 * rows (#275): PNL, Volume, Max Drawdown, Total Equity, Perp Account Equity,
 * Spot Account Equity. Max Drawdown is a `placeholder` row — Hyperliquid does
 * not surface it and equity facets are never app-computed (CONTEXT.md), so it
 * renders the dim dash. Disconnected scalars collapse to `0` (mode-1 wallet
 * gate); a connected-but-empty snapshot leaves them `null` (the dash). The
 * dropdown handlers narrow the raw string before delegating to the typed props.
 */
export function usePortfolioSummaryCard(
  props: PortfolioSummaryCardProps,
): PortfolioSummaryCardContent {
  const {
    snapshot,
    window,
    onWindowChange,
    scope,
    onScopeChange,
    isConnected,
    isLoading,
    isSegregated,
  } = props
  const isSimple = useIsSimpleMode()

  const pnl = isConnected ? (snapshot?.pnl[window] ?? null) : 0
  const volume = isConnected ? (snapshot?.volume[window] ?? null) : 0
  const totalEquity = isConnected ? (snapshot?.accountValue ?? null) : 0
  const perpEquity = isConnected ? (snapshot?.perpsEquity ?? null) : 0
  const spotEquity = isConnected ? (snapshot?.spotEquity ?? null) : 0

  const rows: ReadonlyArray<SummaryRow> = [
    { key: 'pnl', label: SUMMARY_ROW_LABELS.pnl, value: pnl, format: 'signedCurrency' },
    { key: 'volume', label: SUMMARY_ROW_LABELS.volume, value: volume, format: 'currency' },
    { key: 'maxDrawdown', label: SUMMARY_ROW_LABELS.maxDrawdown, value: null, format: 'placeholder' },
    { key: 'totalEquity', label: SUMMARY_ROW_LABELS.totalEquity, value: totalEquity, format: 'currency' },
    { key: 'perpEquity', label: SUMMARY_ROW_LABELS.perpEquity, value: perpEquity, format: 'currency' },
    { key: 'spotEquity', label: SUMMARY_ROW_LABELS.spotEquity, value: spotEquity, format: 'currency' },
  ]

  const onScopeSelect = (value: string) => {
    if (isPortfolioAccountScope(value)) onScopeChange(value)
  }
  const onWindowSelect = (value: string) => {
    if (isPortfolioWindow(value)) onWindowChange(value)
  }

  return {
    isSimple,
    isConnected,
    isLoading,
    scope,
    window,
    scopeOptions: visibleScopeOptions(isSegregated),
    periodOptions: PERIOD_OPTIONS,
    rows,
    onScopeSelect,
    onWindowSelect,
  }
}
