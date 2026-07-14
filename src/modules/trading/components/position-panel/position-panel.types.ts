import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'

/** How a resting order relates to the open position — drives the row's label. */
export type PositionOrderKind = 'take-profit' | 'stop-loss' | 'limit'

/** The two exit legs a trader can attach to an open position. */
export type ExitLegKind = 'takeProfit' | 'stopLoss'

/** One reason a proposed pair of exit targets is not safe to submit. */
export interface ExitTargetIssue {
  leg: ExitLegKind
  message: string
}

export interface UseExitTargetsReturn {
  takeProfitInput: string
  stopLossInput: string
  setTakeProfitInput: (value: string) => void
  setStopLossInput: (value: string) => void
  /** Live ROE preview per leg — null while the field is blank/unparseable. */
  takeProfitRoiPct: number | null
  stopLossRoiPct: number | null
  issues: ReadonlyArray<ExitTargetIssue>
  /** True when at least one leg is set and nothing is wrong. */
  canSubmit: boolean
  isSubmitting: boolean
  submit: () => void
  /** Removes both legs from the position. */
  clear: () => void
  isClearing: boolean
  /** False when the venue exposes no position-protection capability. */
  isSupported: boolean
}

export interface SetExitTargetsSheetProps {
  isOpen: boolean
  onClose: () => void
  position: PerpPositionSnapshot
  liquidationPriceText: string | null
}

export interface ExitLegRowProps {
  label: string
  hint: string
  value: string
  roiPct: number | null
  issue: string | null
  onChange: (value: string) => void
}

export interface UsePositionPanelReturn {
  /** The open position in the selected market, or null when flat. */
  position: PerpPositionSnapshot | null
  /** Resting orders on the selected market, newest first. */
  orders: ReadonlyArray<Order>
  /** Hidden while spectating: the orders stream is keyed to the VIEWED address
   *  but the position is keyed to the ACTING one, so showing both together would
   *  pair your position with someone else's orders. */
  showsOrders: boolean
  /** Formatted liquidation price, or null when the venue reports none. */
  liquidationPriceText: string | null
  baseAsset: string
  /** False when the venue has no positionProtection capability, or while
   *  spectating (you must not set exit targets from someone else's view). */
  supportsExitTargets: boolean
  isExitTargetsOpen: boolean
  openExitTargets: () => void
  closeExitTargets: () => void
  isReduceOpen: boolean
  openReduce: () => void
  closeReduce: () => void
  isClosing: boolean
  /** Market-closes the whole position (reduce-only, opposite side). */
  closePosition: () => void
  cancellingOrderIds: ReadonlySet<string>
  cancelOrder: (order: Order) => void
}

export interface PositionCardProps {
  position: PerpPositionSnapshot
  liquidationPriceText: string | null
  baseAsset: string
  isClosing: boolean
  onClose: () => void
  /** Absent when the venue exposes no position-protection capability. */
  onSetExitTargets?: () => void
  onReduce: () => void
}

export interface PositionOrdersListProps {
  orders: ReadonlyArray<Order>
  baseAsset: string
  cancellingOrderIds: ReadonlySet<string>
  onCancel: (order: Order) => void
}

export interface PositionOrderRowProps {
  order: Order
  baseAsset: string
  isCancelling: boolean
  onCancel: (order: Order) => void
}

/** How a partial reduce executes: now at the mark, or resting at your price. */
export type ReduceMode = 'market' | 'limit'

export interface UseReducePositionReturn {
  mode: ReduceMode
  setMode: (mode: ReduceMode) => void
  /** 0–1 portion of the open position to close. */
  fraction: number
  setFraction: (fraction: number) => void
  /** Coin size the fraction resolves to, clamped to the open size. */
  size: number
  openSize: number
  limitPriceInput: string
  setLimitPriceInput: (value: string) => void
  useMarkPrice: () => void
  isPriceValid: boolean
  canSubmit: boolean
  isSubmitting: boolean
  submit: () => void
}

export interface ReducePositionSheetProps {
  isOpen: boolean
  onClose: () => void
  position: PerpPositionSnapshot
  baseAsset: string
}
