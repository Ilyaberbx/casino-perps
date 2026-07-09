import type { Order, PerpPositionSnapshot, PositionProtectionLegs } from '@/modules/shared/domain'
import type {
  ProtectionBasis,
  ProtectionLegDraft,
  ProtectionLegKind,
} from '@/modules/shared/utils/protection-coupling.types'

/** Which tab of the Position TP/SL modal is showing. */
export type PositionTpslTab = 'create' | 'orders'

/** One leg's draft in the Create panel: the coupled price/gain-loss pair plus
 *  its own $/% basis toggle (TP and SL toggle independently, trade.xyz parity). */
export interface PositionTpslLegState {
  draft: ProtectionLegDraft
  basis: ProtectionBasis
}

/** A resting TP/SL order projected for the Orders-tab table row. */
export interface PositionTpslOrderRow {
  identifier: string
  /** 'Take Profit' / 'Stop Loss' label. */
  typeLabel: string
  triggerPrice: number
  /** Limit price (trigger-limit) or the trigger price itself (trigger-market). */
  price: number
  /** Signed order size in base units (matches the position direction's close). */
  size: number
  /** Expected PnL in USD: (triggerPrice − entryPrice) × size × sideSign. */
  expectedPnlUsd: number
}

export interface PositionTpslDialogProps {
  position: PerpPositionSnapshot | null
  /** All resting open orders — the modal filters to this position's TP/SL legs. */
  restingOrders: ReadonlyArray<Order>
  isMobile: boolean
  onClose: () => void
  onSubmit: (symbol: string, legs: PositionProtectionLegs) => void
  onCancelOrder: (identifier: string) => void
}

export interface PositionTpslPanelProps {
  position: PerpPositionSnapshot
  restingOrders: ReadonlyArray<Order>
  onClose: () => void
  onSubmit: (symbol: string, legs: PositionProtectionLegs) => void
  onCancelOrder: (identifier: string) => void
}

export interface UsePositionTpslArgs {
  position: PerpPositionSnapshot
  restingOrders: ReadonlyArray<Order>
  onSubmit: (symbol: string, legs: PositionProtectionLegs) => void
  onCancelOrder: (identifier: string) => void
  onClose: () => void
}

export interface UsePositionTpslReturn {
  activeTab: PositionTpslTab
  setActiveTab: (tab: PositionTpslTab) => void
  takeProfit: PositionTpslLegState
  stopLoss: PositionTpslLegState
  /** Whether the Configure-Amount block is revealed. */
  configureAmount: boolean
  setConfigureAmount: (on: boolean) => void
  /** Amount input (base units) when Configure Amount is on. */
  amountInput: string
  setAmountInput: (value: string) => void
  /** Fraction (0–1) of the position size the amount represents — slider value. */
  amountFraction: number
  setAmountFraction: (fraction: number) => void
  /** Fill the amount with the full position size (MAX). */
  setAmountToMax: () => void
  /** Whether the Limit-Price block is revealed. */
  limitPriceEnabled: boolean
  setLimitPriceEnabled: (on: boolean) => void
  limitPriceInput: string
  setLimitPriceInput: (value: string) => void
  /** Set a leg's price; re-derives that leg's coupled gain/loss. */
  setLegPrice: (leg: ProtectionLegKind, priceInput: string) => void
  /** Set a leg's gain/loss; re-derives that leg's coupled price. */
  setLegAmount: (leg: ProtectionLegKind, amountInput: string) => void
  /** Toggle a leg's $/% basis (reprojects its gain/loss). */
  setLegBasis: (leg: ProtectionLegKind, basis: ProtectionBasis) => void
  /** Resting TP/SL orders for this position, projected for the Orders table. */
  orderRows: ReadonlyArray<PositionTpslOrderRow>
  canSubmit: boolean
  submit: () => void
  cancelOrder: (identifier: string) => void
}

export interface PositionTpslInfoRowsProps {
  position: PerpPositionSnapshot
  displaySymbol: string
}

export interface PositionTpslLegFieldProps {
  legKind: ProtectionLegKind
  priceLabel: string
  amountLabel: string
  basis: ProtectionBasis
  draft: ProtectionLegDraft
  onPriceChange: (priceInput: string) => void
  onAmountChange: (amountInput: string) => void
  onBasisChange: (basis: ProtectionBasis) => void
}

export interface PositionTpslAmountBlockProps {
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  baseAsset: string
  amountInput: string
  onAmountChange: (value: string) => void
  fraction: number
  onFractionChange: (fraction: number) => void
  onMax: () => void
}

export interface PositionTpslLimitBlockProps {
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  value: string
  onChange: (value: string) => void
}

export interface PositionTpslOrdersTableProps {
  rows: ReadonlyArray<PositionTpslOrderRow>
  onCancel: (identifier: string) => void
}
