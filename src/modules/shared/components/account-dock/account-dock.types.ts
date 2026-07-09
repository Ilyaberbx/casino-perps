import type { ReactNode } from 'react'
import type { ResultAsync } from 'neverthrow'
import type {
  Order,
  Fill,
  Unsubscribe,
  PlaceOrderRequest,
} from '@/modules/shared/domain/domain.types'
import type { PositionProtectionLegs, ModifyOrderRequest } from '@/modules/shared/domain'
import type {
  PerpPositionSnapshot,
  HistoricalOrder,
  FundingHistoryEntry,
  InterestHistoryEntry,
  AccountActivityEntry,
  ActiveTwap,
  PortfolioHistoryFetchError,
} from '@/modules/shared/domain'
import type { UsePaginatedHistoryReturn } from '@/modules/shared/hooks/use-paginated-history.types'
import type { PnlCardView } from '@/modules/shared/components/pnl-card'

/** A bulk action awaiting confirmation in the BulkActionConfirm dialog. */
export type BulkActionKind = 'cancel-all' | 'close-all'

/**
 * Per-position take-profit / stop-loss trigger prices derived from the resting
 * open-orders snapshot (ADR-0051). Each side is absent when no matching leg
 * rests on the position.
 */
export interface PositionTpsl {
  tpPrice?: number
  slPrice?: number
}

export type DockTab =
  | 'balances'
  | 'positions'
  | 'openOrders'
  | 'twap'
  | 'tradeHistory'
  | 'fundingHistory'
  | 'orderHistory'
  | 'interestHistory'
  | 'accountActivity'

/**
 * Structural contract shared by every backward-cursor history capability
 * (trade / order / funding / interest / account-activity / twap history).
 * `usePaginatedHistoryReader` is generic over it so a single seam drives all
 * the dock's paginated tabs — the concrete `*Reader` ports satisfy it by shape.
 */
export interface PaginatedHistoryReader<T> {
  subscribe(onUpdate: (rows: ReadonlyArray<T>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}

/** Return of `usePaginatedHistoryReader`: rows + numbered pagination + lifecycle. */
export interface PaginatedHistoryReaderState<T> {
  rows: ReadonlyArray<T>
  count: number
  pagination: UsePaginatedHistoryReturn<T>
  loadOlder: () => void
  isLoading: boolean
  isExhausted: boolean
  error: PortfolioHistoryFetchError | null
}

export interface UseAccountDockReturn {
  activeTab: DockTab
  setActiveTab: (tab: DockTab) => void
  positions: ReadonlyArray<PerpPositionSnapshot>
  /** Positions enriched with parsed symbol parts for the Positions tab rows. */
  positionRows: ReadonlyArray<PositionRowView>
  /** Positions snapshot in flight — first emission not yet received (ADR-0036). */
  arePositionsLoading: boolean
  /** Open-orders snapshot in flight (ADR-0036). */
  areOpenOrdersLoading: boolean
  /** Active-TWAP snapshot in flight (ADR-0036). */
  areTwapsLoading: boolean
  orders: ReadonlyArray<Order>
  fills: ReadonlyArray<Fill>
  fillsCount: number
  fillsPagination: UsePaginatedHistoryReturn<Fill>
  ordersCount: number
  ordersPagination: UsePaginatedHistoryReturn<HistoricalOrder>
  loadOlderFills: () => void
  isLoadingOlderFills: boolean
  isFillsExhausted: boolean
  fillsHistoryError: string | null
  cancelOrder: (identifier: string) => void
  cancelError: string | null
  /**
   * Inline one-tap Close: full reduce-only market close of the named
   * position (close = a reduce-only `placeOrder`, no separate port). Toasts
   * the pending → outcome lifecycle keyed by cloid; the stream reconciles the
   * table. No-op when the venue lacks `trader` (the button is hidden then).
   */
  closePosition: (symbol: string) => void
  /**
   * Submit an already-built reduce-only close request (partial size or limit
   * close) from the ClosePositionDialog. Same toast lifecycle as `closePosition`.
   */
  submitClose: (request: PlaceOrderRequest) => void
  /** Position whose ⋯ Manage (close) dialog is open, or null when closed. */
  managedPosition: PerpPositionSnapshot | null
  openManage: (position: PerpPositionSnapshot) => void
  closeManage: () => void
  /** Position whose Edit TP/SL dialog is open, or null when closed. */
  protectionPosition: PerpPositionSnapshot | null
  openProtection: (position: PerpPositionSnapshot) => void
  closeProtection: () => void
  /** Set/replace TP/SL on a position via `positionProtection` (`positionTpsl`). */
  submitProtection: (symbol: string, legs: PositionProtectionLegs) => void
  /** Remove all TP/SL protection from a position. */
  clearProtection: (symbol: string) => void
  /** Whether the venue exposes `positionProtection` (Edit TP/SL affordance). */
  hasPositionProtection: boolean
  /** Order whose Modify dialog is open, or null when closed. */
  modifiedOrder: Order | null
  openModify: (order: Order) => void
  closeModify: () => void
  /** Submit a price/size modify for a resting order via `trader.modifyOrder`. */
  submitModify: (request: ModifyOrderRequest, symbol: string) => void
  /** Whether the venue exposes `trader.modifyOrder` (Modify affordance). */
  hasModifyOrder: boolean
  /** The bulk action pending confirmation, or null when the confirm is closed. */
  pendingBulkAction: BulkActionKind | null
  /** Open the BulkActionConfirm for a bulk action (no-op when nothing to act on). */
  requestBulkAction: (kind: BulkActionKind) => void
  /** Convenience: request Cancel-all (Open Orders header). */
  requestCancelAll: () => void
  /** Convenience: request Close-all (Positions header). */
  requestCloseAll: () => void
  /**
   * The bulk-action button to render in the tab strip's toolbar slot for the
   * active tab (Close-all on Positions, Cancel-all on Open Orders), or null
   * when the active tab has no bulk action or there is nothing to act on.
   */
  toolbarAction: { label: string; ariaLabel: string; onClick: () => void } | null
  /** Row count the pending bulk action will act on (for the confirm prompt). */
  bulkActionCount: number
  /** Run the confirmed bulk action (fan-out over rows) and close the confirm. */
  confirmBulkAction: () => void
  /** Dismiss the confirm without acting. */
  dismissBulkAction: () => void
  /** Historical orders (Order History tab) — one-shot retained list. */
  historicalOrders: ReadonlyArray<HistoricalOrder>
  loadOlderOrders: () => void
  isLoadingOrderHistory: boolean
  isOrderHistoryExhausted: boolean
  orderHistoryError: string | null
  /** Funding History tab. */
  fundingCount: number
  fundingPagination: UsePaginatedHistoryReturn<FundingHistoryEntry>
  isLoadingFunding: boolean
  fundingError: string | null
  /** Interest History tab. */
  interestCount: number
  interestPagination: UsePaginatedHistoryReturn<InterestHistoryEntry>
  isLoadingInterest: boolean
  interestError: string | null
  /** Account Activity tab. */
  activityCount: number
  activityPagination: UsePaginatedHistoryReturn<AccountActivityEntry>
  isLoadingActivity: boolean
  activityError: string | null
  /** Active venue's public-explorer URL builder (Account Activity time links). Absent without an explorer. */
  explorerTxUrl?: (transactionHash: string) => string
  /** Active TWAP orders (snapshot — no pagination). */
  activeTwaps: ReadonlyArray<ActiveTwap>
  /** Whether the venue exposes `perpsPositionsSnapshot`. */
  hasPositions: boolean
  /** Whether the venue exposes `openOrdersSnapshot`. */
  hasOpenOrders: boolean
  /** Whether the venue exposes `tradeHistory`. */
  hasTradeHistory: boolean
  /** Whether the venue exposes `orderHistory`. */
  hasOrderHistory: boolean
  /** Whether the venue exposes `fundingHistory`. */
  hasFundingHistory: boolean
  /** Whether the venue exposes `interestHistory`. */
  hasInterestHistory: boolean
  /** Whether the venue exposes `accountActivity`. */
  hasAccountActivity: boolean
  /** Whether the venue exposes `twapActiveSnapshot`. */
  hasTwap: boolean
  /** Whether the venue exposes `trader` (cancel button). */
  hasTrader: boolean
  /** Whether the viewer is spectating another account. While spectating, the
   *  Positions Actions column is dropped entirely (no Close/Manage for a
   *  position you don't own — the cell is empty anyway). */
  isSpectating: boolean
  /** Mobile breakpoint — dialogs render as bottom sheets, ⋯ menus as sheets. */
  isMobile: boolean
  /** The PnL card to share, or null when the share modal is closed. */
  shareView: PnlCardView | null
  /** Whether sharing is offered — false while spectating (you may only share
   *  your own PnL, never the spectated account's). */
  canShare: boolean
  /** Open the share card for an open position (full renderer). */
  onSharePosition: (position: PerpPositionSnapshot) => void
  /** Open the share card for a closed trade fill (degraded renderer). */
  onShareFill: (fill: Fill) => void
  /** Close the share card modal. */
  closeShare: () => void
}

export interface AccountDockProps {
  /**
   * Opaque identity of the account the dock is showing — pass the active
   * Spectated Address (or the connected wallet). Whenever it changes the dock
   * discards the previous account's snapshots and re-bootstraps every paginated
   * history tab, so picking a new user to spectate shows a fresh dock. Omit to
   * key the dock to the connected wallet only.
   */
  reloadKey?: string | null
  /**
   * Called with a position's market symbol when its row is clicked. Wired by
   * `TradingPage` to `setSelectedMarket` so clicking a position loads that
   * market on the chart. Omitted where there is no chart to drive (e.g. the
   * portfolio page) — position symbols are then non-interactive.
   */
  onSelectMarket?: (symbol: string) => void
}

export interface DockPanelProps {
  isActive: boolean
  ariaLabel: string
  /** When false, the panel renders the "unsupported on this venue" message. */
  hasCapability: boolean
  /** Wallet-gate copy shown by `DisconnectedTablePlaceholder` when disconnected. */
  connectMessage: string
  children: ReactNode
}

/**
 * Prop slice for the `AccountDockTabPanels` sub-component: the full dock state
 * owned by `useAccountDock`, plus the `onSelectMarket` callback the parent
 * receives. The sub-component is dumb — it never calls `useAccountDock`; the
 * parent passes its single state object straight through.
 */
export interface AccountDockTabPanelsProps {
  dock: UseAccountDockReturn
  reloadKey?: string | null
  onSelectMarket?: (symbol: string) => void
}

/**
 * Prop slice for the `AccountDockDialogs` sub-component: the modal/confirm
 * cluster (bulk-action confirm + PnL share card) rendered outside the tab
 * panels. Dumb — fed entirely by the parent's `useAccountDock` state.
 */
export interface AccountDockDialogsProps {
  pendingBulkAction: UseAccountDockReturn['pendingBulkAction']
  bulkActionCount: number
  isMobile: boolean
  shareView: UseAccountDockReturn['shareView']
  onConfirmBulkAction: () => void
  onDismissBulkAction: () => void
  onCloseShare: () => void
}

/**
 * A position enriched with its parsed symbol parts for rendering. The hook
 * (`useAccountDock`) runs `parseHip3Symbol` once per position so the dumb
 * Positions components never call the util inline: HIP-3 rows render the clean
 * `displaySymbol` (`NVDA`) plus a `dexTag` badge (`XYZ`); main-dex rows render
 * the bare symbol with no badge (`isHip3 === false`).
 */
export interface PositionRowView {
  position: PerpPositionSnapshot
  /** Clean asset name to display (`NVDA` for `xyz:NVDA`, `BTC` for `BTC`). */
  displaySymbol: string
  /** Uppercased builder-dex tag for the badge (`XYZ`); empty for main-dex. */
  dexTag: string
  /** Whether this is a HIP-3 position (drives the dex badge). */
  isHip3: boolean
  /** Take-profit / stop-loss trigger prices from resting orders (ADR-0051). */
  tpsl: PositionTpsl
}

export interface PositionsPanelProps {
  positionRows: ReadonlyArray<PositionRowView>
  /** Snapshot in flight — render the loading skeleton instead of the empty state. */
  isLoading: boolean
  onClosePosition: (symbol: string) => void
  onManagePosition: (position: PerpPositionSnapshot) => void
  onEditTpsl: (position: PerpPositionSnapshot) => void
  /** Open the shareable PnL card for a position. */
  onSharePosition: (position: PerpPositionSnapshot) => void
  /** Whether the per-row Share affordance is shown (hidden while spectating). */
  canShare: boolean
  /** Select a position's market on the chart (omit to make symbols non-interactive). */
  onSelectPosition?: (symbol: string) => void
  hasTrader: boolean
  hasPositionProtection: boolean
  /** Whether the Actions column (Close / Manage) is rendered at all. False while
   *  spectating — the column is dropped (header + cells + grid track), not just
   *  emptied. */
  showActionsColumn: boolean
}

export interface BulkActionConfirmProps {
  action: BulkActionKind | null
  isMobile: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
}

export interface OpenOrdersPanelProps {
  orders: ReadonlyArray<Order>
  /** Snapshot in flight — render the loading skeleton instead of the empty state. */
  isLoading: boolean
  onCancelOrder: (identifier: string) => void
  onModifyOrder: (order: Order) => void
  cancelError: string | null
  hasTrader: boolean
  hasModifyOrder: boolean
  /** Whether the Actions column (Cancel / Modify) is rendered at all. False while
   *  spectating — the column is dropped (header + cells + grid track), not just
   *  emptied. */
  showActionsColumn: boolean
}

export interface TradeHistoryPanelProps {
  pagination: UsePaginatedHistoryReturn<Fill>
  totalCount: number
  isLoading: boolean
  historyError: string | null
  /** Open the shareable PnL card for a closed fill (degraded renderer). */
  onShareFill: (fill: Fill) => void
  /** Whether the per-row Share affordance is shown (hidden while spectating). */
  canShare: boolean
}

export interface OrderHistoryPanelProps {
  pagination: UsePaginatedHistoryReturn<HistoricalOrder>
  totalCount: number
  isLoading: boolean
  historyError: string | null
}

export interface FundingHistoryPanelProps {
  pagination: UsePaginatedHistoryReturn<FundingHistoryEntry>
  totalCount: number
  isLoading: boolean
  historyError: string | null
}

export interface InterestHistoryPanelProps {
  pagination: UsePaginatedHistoryReturn<InterestHistoryEntry>
  totalCount: number
  isLoading: boolean
  historyError: string | null
}

export interface AccountActivityPanelProps {
  pagination: UsePaginatedHistoryReturn<AccountActivityEntry>
  totalCount: number
  isLoading: boolean
  historyError: string | null
  /** Public-explorer URL builder from `Venue.metadata.explorerTxUrl`. Absent when the venue has no explorer. */
  explorerTxUrl?: (transactionHash: string) => string
}

export interface OrderHistoryRowProps {
  order: HistoricalOrder
}

export interface OrderRowProps {
  order: Order
  onCancel: () => void
  onModify: () => void
  hasTrader: boolean
  hasModifyOrder: boolean
  /** Whether the Actions cell + its grid track are rendered. False while
   *  spectating — keeps the row's column count in sync with the header. */
  showActionsColumn: boolean
}

export interface ModifyOrderDialogProps {
  order: Order | null
  isMobile: boolean
  onClose: () => void
  onSubmit: (request: ModifyOrderRequest, symbol: string) => void
}

export interface ModifyOrderFormProps {
  order: Order
  onClose: () => void
  onSubmit: (request: ModifyOrderRequest, symbol: string) => void
}

export interface PositionRowProps {
  position: PerpPositionSnapshot
  /** Clean asset name to render in the symbol cell (`NVDA` for `xyz:NVDA`). */
  displaySymbol: string
  /** Builder-dex tag for the HIP-3 badge (`XYZ`); empty for main-dex. */
  dexTag: string
  /** When true, render the `dexTag` badge next to the symbol. */
  isHip3: boolean
  /** Take-profit / stop-loss trigger prices to render in the TP/SL cell (ADR-0051). */
  tpsl: PositionTpsl
  onClose: () => void
  onOpenManage: () => void
  onEditTpsl: () => void
  /** Open the shareable PnL card for this position; omit to hide the affordance
   *  (e.g. while spectating, where sharing the viewed account's PnL is forbidden). */
  onShare?: () => void
  /** Load this position's market on the chart (omit to render the symbol as static text). */
  onSelect?: () => void
  hasTrader: boolean
  hasPositionProtection: boolean
  /** Whether the Actions cell + its grid track are rendered. False while
   *  spectating — keeps the row's column count in sync with the header. */
  showActionsColumn: boolean
}

/** How a non-full close sizes the reduce-only order. */
export type CloseSizeBasis = 'coin' | 'percent'

/** Which close flow the dialog submits. */
export type CloseKind = 'partial' | 'limit'

export interface ClosePositionDialogProps {
  position: PerpPositionSnapshot | null
  isMobile: boolean
  onClose: () => void
  onSubmit: (request: PlaceOrderRequest) => void
}

export interface ClosePositionFormProps {
  position: PerpPositionSnapshot
  onClose: () => void
  onSubmit: (request: PlaceOrderRequest) => void
}

export interface TradeHistoryRowProps {
  fill: Fill
  /** Open the shareable PnL card for this fill; omit when it carries no realized PnL. */
  onShare?: () => void
}

export interface FundingHistoryRowProps {
  entry: FundingHistoryEntry
}

export interface InterestHistoryRowProps {
  entry: InterestHistoryEntry
}

export interface AccountActivityRowProps {
  entry: AccountActivityEntry
  /** Public-explorer URL builder; when present the time cell links the entry hash. */
  explorerTxUrl?: (transactionHash: string) => string
}

