import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useIsWalletConnected } from '@/modules/account'
import { useCapabilityOptional, useVenueOptional } from '@/modules/shared/providers/venue-provider'
import {
  useManageFunds,
  DEFAULT_MANAGE_FUNDS_TAB,
  MANAGE_FUNDS_SINGLE_LABEL,
} from '@/modules/shared/providers/manage-funds-provider'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { toast } from '@/modules/shared/services/toast'
import { useIsSpectating } from '@/modules/spectate'
import type { ManageFundsTab } from '@/modules/shared/providers/manage-funds-provider'
import type {
  EquityExtensionBucket,
  MarginSummarySnapshot,
  PortfolioSnapshot,
} from '@/modules/shared/domain'
import type { FundingAction, TradeEquityCardContent } from './trade-equity-card.types'
import {
  FUNDING_ACTION_LABELS,
  SPECTATE_FUNDS_TOAST_DESCRIPTION,
  SPECTATE_FUNDS_TOAST_TITLE,
} from './trade-equity-card.constants'
import {
  buildEquityRows,
  buildLeverageBreakdown,
  filterSimpleEquityRows,
} from './trade-equity-card.utils'

/**
 * Smart hook for the Trade-page equity card. Reads the viewing-keyed capabilities
 * (`portfolio` snapshot at `'all'` scope = mode-correct net worth, `accountMode`,
 * `equityExtensions`) so the card shows the ghosted account while spectating, and
 * the curated Manage-Funds deep links. The derived sub-group (uPnL / Maintenance
 * Margin / Account Leverage) is a placeholder here — the `marginSummary` reader
 * wires it in a later slice. Venue-agnostic: capability ports only.
 */
export function useTradeEquityCard(): TradeEquityCardContent {
  const isConnected = useIsWalletConnected()
  const portfolio = useCapabilityOptional('portfolio')
  const accountMode = useCapabilityOptional('accountMode')
  const equityExtensions = useCapabilityOptional('equityExtensions')
  const marginSummaryCap = useCapabilityOptional('marginSummary')
  const venue = useVenueOptional()
  const { open } = useManageFunds()
  const isMobile = useIsMobile()
  const isSpectating = useIsSpectating()
  // Pro mode is gone (PRD-0008 D7): everything renders in its condensed form.
  const isSimple = true
  const [isExpanded, setExpanded] = useState(false)

  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [buckets, setBuckets] = useState<ReadonlyArray<EquityExtensionBucket>>([])
  const [margin, setMargin] = useState<MarginSummarySnapshot | null>(null)

  // The `portfolio` subscription below is persistent across a spectate toggle
  // (never re-subscribed), so without this the card would keep rendering the
  // PREVIOUS address's last-known total until the venue's fresh tick for the
  // new address lands. Reset to the loading state on every toggle instead —
  // never wrong data, at worst a beat longer of loading. Adjusting state
  // during render (not in an effect) on a prop/value change is the sanctioned
  // React pattern for this — see https://react.dev/learn/you-might-not-need-an-effect.
  const [prevIsSpectating, setPrevIsSpectating] = useState(isSpectating)
  if (isSpectating !== prevIsSpectating) {
    setPrevIsSpectating(isSpectating)
    setSnapshot(null)
  }

  // accountMode exposes current() + subscribe() — read it as an external store so
  // the initial value needs no setState-in-effect (React Compiler lint).
  const isSegregated = useSyncExternalStore(
    (onStoreChange) => {
      if (accountMode === undefined) return () => {}
      return accountMode.subscribe(() => onStoreChange())
    },
    () => accountMode?.current().isSegregated ?? true,
  )

  useEffect(() => {
    const hasSubscription = isConnected && portfolio !== undefined
    if (!hasSubscription) return
    // setState lives in the reader callback, never synchronously in the effect
    // body; disconnected reads gate on isConnected, so a stale snapshot never shows.
    return portfolio.subscribeSnapshot('all', setSnapshot)
  }, [isConnected, portfolio])

  useEffect(() => {
    if (equityExtensions === undefined) return
    return equityExtensions.subscribe('all', setBuckets)
  }, [equityExtensions])

  useEffect(() => {
    if (marginSummaryCap === undefined) return
    return marginSummaryCap.subscribe(setMargin)
  }, [marginSummaryCap])

  const activeMargin = isConnected ? margin : null
  const isLoading = isConnected && portfolio !== undefined && snapshot === null
  // accountValue at 'all' scope is the mode-correct net worth (ADR-0033); never
  // read raw perp-margin fields here. The reference headline excludes unrealized
  // PnL (shown as its own row), so subtract the Venue-supplied uPnL — a display
  // decomposition of two Venue scalars, not an app re-derivation (ADR-0072).
  // Disconnected → 0 so the headline reads $0.00.
  const upnlOffset = activeMargin?.unrealizedPnlUsd ?? 0
  const rawTotal = isConnected ? (snapshot?.accountValue ?? null) : 0
  const totalEquity = rawTotal === null ? null : rawTotal - upnlOffset
  const marginRatioPct = activeMargin?.marginRatioPct ?? null
  const spotEquity = isConnected ? (snapshot?.spotEquity ?? null) : 0
  const perpsEquity = isConnected ? (snapshot?.perpsEquity ?? null) : 0

  const rows = buildEquityRows({
    isSegregated,
    isConnected,
    spotEquity,
    perpsEquity,
    buckets,
    margin: activeMargin,
  })
  const leverageBreakdown = buildLeverageBreakdown(activeMargin, isSegregated)

  const hasDeposit = venue?.deposit != null
  const hasTransfer = venue?.transfer != null && isSegregated
  const hasWithdraw = venue?.withdraw != null
  const fundingActions: FundingAction[] = []
  if (hasDeposit) fundingActions.push({ tab: 'deposit', label: FUNDING_ACTION_LABELS.deposit })
  if (hasTransfer) fundingActions.push({ tab: 'transfer', label: FUNDING_ACTION_LABELS.transfer })
  if (hasWithdraw) fundingActions.push({ tab: 'withdraw', label: FUNDING_ACTION_LABELS.withdraw })

  // Simple mode (#278): the breakdown trims to Spot / Perps / Unrealized PNL, and
  // the three funding actions collapse to a single "Manage Funds" button opening
  // the modal on its default tab. Pro mode keeps the full breakdown + actions.
  const hasFunding = fundingActions.length > 0
  const visibleRows = isSimple ? filterSimpleEquityRows(rows) : rows
  const simpleFundingActions: ReadonlyArray<FundingAction> = hasFunding
    ? [{ tab: DEFAULT_MANAGE_FUNDS_TAB, label: MANAGE_FUNDS_SINGLE_LABEL }]
    : []
  const visibleFundingActions = isSimple ? simpleFundingActions : fundingActions

  // Display follows the ghosted account, but funding is self-only: toast instead
  // of opening Manage Funds while spectating (ADR-0072).
  const onOpenFunds = useCallback(
    (tab: ManageFundsTab) => {
      if (isSpectating) {
        toast.show({
          variant: 'info',
          title: SPECTATE_FUNDS_TOAST_TITLE,
          description: SPECTATE_FUNDS_TOAST_DESCRIPTION,
        })
        return
      }
      open(tab)
    },
    [isSpectating, open],
  )

  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), [])
  const isCollapsible = isMobile
  const rowsVisible = !isCollapsible || isExpanded

  return {
    isConnected,
    isLoading,
    totalEquity,
    marginRatioPct,
    rows: visibleRows,
    leverageBreakdown,
    fundingActions: visibleFundingActions,
    isCollapsible,
    isExpanded,
    rowsVisible,
    toggleExpanded,
    onOpenFunds,
  }
}
