import type { KeyboardEvent, RefObject } from 'react'
import type { Side, TriggerLeg, OrderTimeInForce } from '../../../shared/domain/domain.types'
import type {
  ProtectionBasis,
  ProtectionLegDraft,
  ProtectionLegKind,
} from '@/modules/shared/utils/protection-coupling.types'

export type {
  ProtectionBasis,
  ProtectionLegDraft,
  ProtectionLegKind,
  DeriveTriggerContext,
} from '@/modules/shared/utils/protection-coupling.types'

/** The five order types the panel can submit. `market`/`limit` are always
 *  available; `stop-market`/`stop-limit`/`twap` live behind the Pro dropdown and
 *  surface only when their venue capability flag is set. See ADR-0034 D-1. */
export type OrderType = 'market' | 'limit' | 'stop-market' | 'stop-limit' | 'twap'

/** The advanced order types surfaced behind the Pro dropdown. Subset of
 *  `OrderType` excluding the always-present `market`/`limit`. */
export type ProType = 'stop-market' | 'stop-limit' | 'twap'

/** The capability flag on `Trader` that gates a Pro type into the menu. */
export type ProTypeFlag = 'supportsStopOrders' | 'supportsTwap'

/** A Pro menu entry: the type, its label, and the venue capability flag that
 *  must be set for it to appear. See `PRO_TYPE_DESCRIPTORS` (reference order). */
export interface ProTypeDescriptor {
  value: ProType
  label: string
  flag: ProTypeFlag
}

/** Redesigned 2×2 TP/SL draft (reference parity): a section checkbox, a shared
 *  $/% basis toggle, and a price+gain/loss pair per leg. Only `market`/`limit`
 *  render it. See IA "Form State Model". */
export interface EntryProtectionDraft {
  enabled: boolean
  basis: ProtectionBasis
  takeProfit: ProtectionLegDraft
  stopLoss: ProtectionLegDraft
}

/** Whether the size field is entered in base (coin) units or USD margin
 *  (collateral). Base units are the position size we sign directly. USD is the
 *  margin the user commits: the leveraged position is `coin = margin × leverage
 *  / price`, so Order Value = margin × leverage. At 1× (spot) margin equals the
 *  notional. Switching the unit converts the typed value to hold the order fixed
 *  (`convertSizeInput`); the % slider sizes off buying power = margin × leverage. */
export type SizeUnit = 'coin' | 'usd'

/** Whether the Available-to-Trade figure (and MAX/% basis) is a USD amount
 *  (perp margin / spot USDC on a buy) or a coin amount (spot base holdings on a
 *  sell). */
export type AvailableUnit = 'usd' | 'coin'

export interface OrderEntryFormState {
  orderType: OrderType
  side: Side
  sizeInput: string
  sizeUnit: SizeUnit
  /** Limit price — used by limit and stop-limit. */
  priceInput: string
  /** Stop trigger price — used by stop-market and stop-limit. */
  stopPriceInput: string
  /** Market-order slippage tolerance as a percent string (summary slippage row).
   *  Empty ⇒ the default applies at submit. Only used in market mode. */
  slippageInput: string
  /** Reduce-only flag — caps the order to closing existing exposure. */
  reduceOnly: boolean
  /** Time-in-force for limit orders (ignored for non-limit orders). */
  timeInForce: OrderTimeInForce
  /** TWAP running-time hours component. */
  twapHoursInput: string
  /** TWAP running-time minutes component. */
  twapMinutesInput: string
  /** TWAP slice randomization. */
  randomize: boolean
}

/**
 * Per-field touched tracking (ADR-0035 D-6). `trading/` owns *when* to surface a
 * venue issue: a field's inline error stays hidden until the user touches it (or
 * a submit is attempted, which marks every field touched). The venue's
 * `validateDraft` still reports every issue immediately and `canSubmit` gates on
 * the full set — touched only governs presentation, never the submit gate.
 */
export interface OrderEntryTouched {
  size: boolean
  price: boolean
  stopPrice: boolean
  slippage: boolean
  twapDuration: boolean
}

export interface OrderEntryValidation {
  isSizeValid: boolean
  isPriceValid: boolean
  /** Stop price > 0 when the active type needs one; true otherwise. */
  isStopPriceValid: boolean
  /** TWAP running time within [5m, 24h] when the active type is twap; true
   *  otherwise. */
  isTwapDurationValid: boolean
  /** False when TP/SL is enabled (market/limit) but a leg yields no positive
   *  derived trigger. True when TP/SL is off or not applicable. */
  isProtectionValid: boolean
  /** False when the order value (notional = size × reference price) is below
   *  Hyperliquid's $10 minimum. True for reduce-only/closing orders (exempt) and
   *  when the reference price is unknown (can't be checked client-side yet). */
  isOrderValueValid: boolean
  /** False when a slippage-carrying type (market/stop-market) has a non-empty but
   *  invalid slippage input (negative/zero/non-numeric). True when the field is
   *  empty (falls back to default), valid, or the type carries no slippage. */
  isSlippageValid: boolean
  canSubmit: boolean
}

/** Type-aware pre-trade estimates for the summary footer. The venue owns final
 *  rejection. `hasBuilderFee` controls whether the fee line is annotated as
 *  including the builder fee. `kind` discriminates the per-type footer rows. */
export type PreTradeEstimates = LinearPreTradeEstimates | TwapPreTradeEstimates

/** Market / limit / stop estimates. `liquidationPrice` is 0 for non-market
 *  types (the reference footer omits the liq row outside market). */
export interface LinearPreTradeEstimates {
  kind: 'linear'
  notional: number
  margin: number
  liquidationPrice: number
  fee: number
  hasBuilderFee: boolean
}

/** TWAP slicing estimates. `notional` is the total order value (coin × mark) the
 *  schedule works through — mirrors the linear estimate so the % slider can
 *  back-compute the coin size for a TWAP draft too. */
export interface TwapPreTradeEstimates {
  kind: 'twap'
  notional: number
  frequencySeconds: number
  runtimeMinutes: number
  numberOfOrders: number
  sizePerSuborder: number
  fee: number
  hasBuilderFee: boolean
}

/**
 * Starting-state overrides for {@link useOrderEntry}. Both default to the Pro
 * ticket's behaviour, so passing nothing preserves it exactly. This is a hook
 * argument rather than a component prop — the ticket components stay dumb.
 */
export interface UseOrderEntryOptions {
  /** Sizing unit the ticket opens in. Simple opens in `usd`; Pro in `coin`. */
  initialSizeUnit?: SizeUnit
  /** Side the ticket opens on. Used by "Add to position" to pin the side. */
  initialSide?: Side
}

/**
 * The Simple ticket's own state, on top of everything `useOrderEntry` returns.
 * Simple is market-by-default; turning on the price target flips the order type
 * to `limit` (miracle's only limit affordance). The review sheet is the confirm
 * step — the ticket's primary button opens it, and the sheet submits.
 */
export interface UseSimpleOrderTicketReturn extends UseOrderEntryReturn {
  /** True when the price target is on, i.e. the order is a limit. */
  isPriceTargetOn: boolean
  togglePriceTarget: () => void
  isReviewOpen: boolean
  openReview: () => void
  closeReview: () => void
}

export interface SimpleReviewSheetProps {
  isOpen: boolean
  onClose: () => void
  ticket: UseSimpleOrderTicketReturn
  baseAsset: string
}

export interface PriceTargetToggleProps {
  isOn: boolean
  onToggle: () => void
}

export interface UseOrderEntryReturn {
  form: OrderEntryFormState
  validation: OrderEntryValidation
  isSubmitting: boolean
  errorMessage: string | null
  isSpectating: boolean
  /** Live mark price for the selected market (0 when unknown) — drives the
   *  coin⇄USD conversion and % slider. */
  markPrice: number
  /** Funds available to open the order. Perp/HIP-3: free margin (USD). Spot buy:
   *  USDC spot balance (USD). Spot sell: base-token holdings (coin). The unit is
   *  carried by `availableUnit`. */
  availableToTrade: number
  /** Whether `availableToTrade` is a USD amount or a base-coin amount. */
  availableUnit: AvailableUnit
  /** True when the selected market is spot — drives ticket gating (Buy/Sell
   *  labels, no leverage/liq/reduce-only/margin-unit, market+limit only). */
  isSpot: boolean
  /** True when the selected market is a HIP-3 (builder-deployed) market — drives
   *  the order-entry HIP-3 abstraction gate (ADR-0081). */
  isHip3: boolean
  /** Set when the order value is below the $10 minimum (and size is otherwise
   *  valid) — a human hint rendered under the size field; null when valid. */
  minOrderValueHint: string | null
  /** Set when a slippage-carrying type has a non-empty but invalid slippage
   *  input — a human hint rendered under the slippage control; null when valid. */
  slippageHint: string | null
  /** Signed open position size in the selected market (+long / −short / 0). */
  currentPositionSize: number
  /** Order size as a fraction (0–1) of max buying power — drives the % slider. */
  sizeFraction: number
  /** Pre-trade estimates for the summary footer. */
  estimates: PreTradeEstimates
  /** Whether the active venue accepts entry-attached TP/SL legs — gates the
   *  TP/SL section's presence (with `orderType ∈ {market, limit}`). */
  supportsTriggerOrders: boolean
  /** Whether the active venue accepts stop orders — gates the Pro Stop types. */
  supportsStopOrders: boolean
  /** Whether the active venue accepts TWAP orders — gates the Pro TWAP type. */
  supportsTwap: boolean
  /** Whether the TP/SL section is rendered (trigger support ∧ market/limit). */
  isProtectionApplicable: boolean
  /** Draft TP/SL legs attached at entry. */
  protection: EntryProtectionDraft
  setOrderType: (orderType: OrderType) => void
  setSide: (side: Side) => void
  setSizeInput: (value: string) => void
  setSizeUnit: (unit: SizeUnit) => void
  setSizeFromBuyingPowerFraction: (fraction: number) => void
  setPriceInput: (value: string) => void
  /** Fills the limit price with the current market mid (top-of-book midpoint). */
  setPriceFromMid: () => void
  setStopPriceInput: (value: string) => void
  /** Fills the stop trigger price with the current market mid. */
  setStopPriceFromMid: () => void
  setProtectionEnabled: (enabled: boolean) => void
  setProtectionBasis: (basis: ProtectionBasis) => void
  /** Set a leg's price; re-derives that leg's coupled gain/loss off mark/entry. */
  setProtectionLegPrice: (leg: ProtectionLegKind, priceInput: string) => void
  /** Set a leg's gain/loss; re-derives that leg's coupled price off mark/entry. */
  setProtectionLegAmount: (leg: ProtectionLegKind, amountInput: string) => void
  setSlippageInput: (value: string) => void
  setReduceOnly: (reduceOnly: boolean) => void
  setTimeInForce: (timeInForce: OrderTimeInForce) => void
  setTwapHours: (value: string) => void
  setTwapMinutes: (value: string) => void
  setRandomize: (randomize: boolean) => void
  submit: () => void
  stopSpectating: () => void
}

export interface OrderTypeControlProps {
  orderType: OrderType
  /** Whether the active venue accepts stop orders (gates the two stop types). */
  supportsStopOrders: boolean
  /** Whether the active venue accepts TWAP orders (gates the TWAP type). */
  supportsTwap: boolean
  onOrderTypeChange: (orderType: OrderType) => void
}

export interface ProTypeMenuProps {
  /** The capability-filtered Pro types, in reference order. */
  descriptors: ReadonlyArray<ProTypeDescriptor>
  /** The currently highlighted option (virtual focus via aria-activedescendant). */
  activeIndex: number
  /** The active Pro type, when one is selected (highlights its row). */
  selectedType: ProType | null
  listboxId: string
  optionId: (index: number) => string
  listRef: RefObject<HTMLUListElement | null>
  onListKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  onOptionClick: (index: number) => void
}

export interface UseOrderTypeControlParams {
  orderType: OrderType
  supportsStopOrders: boolean
  supportsTwap: boolean
  onOrderTypeChange: (orderType: OrderType) => void
}

export interface UseOrderTypeControlReturn {
  /** The capability-filtered Pro descriptors. Empty ⇒ omit the 3rd segment. */
  proDescriptors: ReadonlyArray<ProTypeDescriptor>
  /** True when at least one Pro type is available (render the 3rd segment). */
  hasProTypes: boolean
  /** The label for the 3rd segment: the active Pro type's name, else 'Pro'. */
  proSegmentLabel: string
  /** The active Pro type when the 3rd segment is selected, else null. */
  activeProType: ProType | null
  /** True when the active order type is one of the Pro types. */
  isProActive: boolean
  isMenuOpen: boolean
  activeIndex: number
  triggerRef: RefObject<HTMLButtonElement | null>
  listRef: RefObject<HTMLUListElement | null>
  listboxId: string
  optionId: (index: number) => string
  selectMarket: () => void
  selectLimit: () => void
  onTriggerClick: () => void
  onTriggerKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onListKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  onOptionClick: (index: number) => void
}

export interface SizeInputProps {
  value: string
  unit: SizeUnit
  isValid: boolean
  baseAsset: string
  quoteLabel: string
  /** Current order size as a fraction (0–1) of buying power — slider position. */
  fraction: number
  onChange: (value: string) => void
  onUnitChange: (unit: SizeUnit) => void
  /** Sets the size from a buying-power fraction (MAX button + % slider). */
  onFractionChange: (fraction: number) => void
}

export interface OrderInfoRowsProps {
  availableToTrade: number
  /** USD figure (perp margin / spot buy USDC) or coin figure (spot sell holdings). */
  availableUnit: AvailableUnit
  currentPositionSize: number
  baseAsset: string
}

export interface OrderOptionsProps {
  /** Whether the Reduce-Only toggle is shown — hidden on spot (no position to
   *  reduce; a spot sell already reduces holdings). */
  showReduceOnly: boolean
  reduceOnly: boolean
  onReduceOnlyChange: (reduceOnly: boolean) => void
  /** When true the limit-only TIF selector is shown. */
  isLimit: boolean
  timeInForce: OrderTimeInForce
  onTimeInForceChange: (timeInForce: OrderTimeInForce) => void
  /** When true the TWAP-only Randomize checkbox is shown. */
  isTwap: boolean
  randomize: boolean
  onRandomizeChange: (randomize: boolean) => void
}

/** The TWAP running-time field pair (Hour / Minute). Clamped to [5m, 24h] by the
 *  validation in the hook; this component only owns the two numeric inputs. */
export interface TwapRunningTimeProps {
  hoursInput: string
  minutesInput: string
  /** False when the combined running time falls outside [5m, 24h]. */
  isValid: boolean
  onHoursChange: (value: string) => void
  onMinutesChange: (value: string) => void
}

/** Editable market-order slippage control, folded into the pre-trade summary.
 *  The venue owns the default slippage (applied when the field is empty), so the
 *  control carries no default — the field shows a neutral placeholder. */
export interface SlippageControl {
  value: string
  onChange: (value: string) => void
}

export interface PriceInputProps {
  /** Field label — 'Limit price' here, reused for Stop-Limit's limit price. */
  label: string
  value: string
  isValid: boolean
  isDisabled: boolean
  /** Top-of-book midpoint used by the MID chip (0 ⇒ chip disabled). */
  midPrice: number
  onChange: (value: string) => void
  /** Fills the field with the current market mid. */
  onUseMid: () => void
}

/** The stop trigger price field (+MID) — rendered for stop-market and
 *  stop-limit. Always editable (no `isDisabled`), labelled 'Stop Price'. */
export interface StopPriceInputProps {
  value: string
  isValid: boolean
  /** Top-of-book midpoint used by the MID chip (0 ⇒ chip disabled). */
  midPrice: number
  onChange: (value: string) => void
  /** Fills the field with the current market mid. */
  onUseMid: () => void
}

export interface SideToggleProps {
  side: Side
  onSideChange: (side: Side) => void
}

export interface SubmitButtonProps {
  side: Side
  orderType: OrderType
  isDisabled: boolean
  isSubmitting: boolean
  onSubmit: () => void
}

export interface StopSpectatingButtonProps {
  onStopSpectating: () => void
}

export interface PreTradeSummaryProps {
  estimates: PreTradeEstimates
  /** Market-order slippage row (folded into the summary). Null when not market. */
  slippage: SlippageControl | null
  /** Whether the Liquidation Price row is shown — true for perp/HIP-3 market
   *  orders, false on spot (no liquidation) and non-market types. */
  showLiquidation: boolean
}

export interface EntryTpslSectionProps {
  protection: EntryProtectionDraft
  onEnabledChange: (enabled: boolean) => void
  onBasisChange: (basis: ProtectionBasis) => void
  /** Set a leg's price (the coupled gain/loss is re-derived by the hook). */
  onLegPriceChange: (leg: ProtectionLegKind, priceInput: string) => void
  /** Set a leg's gain/loss (the coupled price is re-derived by the hook). */
  onLegAmountChange: (leg: ProtectionLegKind, amountInput: string) => void
}

/** One row of the TP/SL 2×2 grid: a Price cell + a coupled Gain/Loss cell. */
export interface ProtectionLegRowProps {
  legKind: ProtectionLegKind
  /** Price-cell placeholder — 'TP Price' or 'SL Price'. */
  priceLabel: string
  /** Gain/Loss-cell placeholder — 'Gain' or 'Loss'. */
  amountLabel: string
  basis: ProtectionBasis
  draft: ProtectionLegDraft
  onPriceChange: (priceInput: string) => void
  onAmountChange: (amountInput: string) => void
}

/** A built TP/SL leg pair derived from the draft (undefined when disabled or
 *  invalid). Re-exported for the build util's return type. */
export interface BuiltEntryProtection {
  takeProfit?: TriggerLeg
  stopLoss?: TriggerLeg
}

/** Context shared across both legs (basis is read from the draft). */
export interface ProtectionContext {
  side: Side
  referencePrice: number
  size: number
}
