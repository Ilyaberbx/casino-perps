import { useState, useCallback, useMemo, useEffect } from 'react'
import { useCapability, useOwnCapability } from '../../../shared/providers/venue-provider'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { useLeverageMargin } from '../../providers/leverage-margin'
import { useOrderIntent } from '../../providers/order-intent-provider'
import { useSpectate } from '@/modules/spectate'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { specFromMarket } from '@/modules/shared/utils/format-price'
import { toast } from '@/modules/shared/services/toast'
import {
  DEFAULT_PRICE,
  DEFAULT_SIZE,
  DEFAULT_TWAP_HOURS,
  DEFAULT_TWAP_MINUTES,
  INITIAL_ENTRY_PROTECTION,
  ORDER_CLOID_PREFIX,
  STOP_SPECTATING_HOTKEY,
} from './order-entry.constants'
import {
  buildPendingOrderToast,
  buildOutcomeToast,
  buildOrderErrorToast,
  placeOrderErrorMessage,
} from './order-entry.utils'
import {
  buildEntryProtection,
  coupleFromAmountInput,
  coupleFromPriceInput,
  isLegPopulated,
  isProtectionValid,
  reprojectProtectionToBasis,
  triggerKindFor,
} from './entry-protection.utils'
import { useLiveMark } from './use-live-mark'
import type {
  AvailableUnit,
  EntryProtectionDraft,
  OrderEntryFormState,
  OrderEntryTouched,
  OrderType,
  OrderEntryValidation,
  PreTradeEstimates,
  ProtectionBasis,
  ProtectionContext,
  ProtectionLegDraft,
  ProtectionLegKind,
  SizeUnit,
  UseOrderEntryOptions,
  UseOrderEntryReturn,
} from './order-entry.types'
import type {
  OrderDraft,
  OrderField,
  OrderIssue,
  PlaceOrderRequest,
  Side,
  OrderTimeInForce,
} from '../../../shared/domain/domain.types'
import type { OrderIntent } from '../../trading.types'

const INITIAL_FORM: OrderEntryFormState = {
  orderType: 'market',
  side: 'buy',
  sizeInput: DEFAULT_SIZE,
  sizeUnit: 'coin',
  priceInput: DEFAULT_PRICE,
  stopPriceInput: '',
  slippageInput: '',
  reduceOnly: false,
  timeInForce: 'Gtc',
  twapHoursInput: DEFAULT_TWAP_HOURS,
  twapMinutesInput: DEFAULT_TWAP_MINUTES,
  randomize: false,
}

const INITIAL_TOUCHED: OrderEntryTouched = {
  size: false,
  price: false,
  stopPrice: false,
  slippage: false,
  twapDuration: false,
}

/**
 * The ticket's starting state. `options` only shifts the two defaults that
 * differ between the ticket flavours: the Simple ticket sizes in USD (miracle
 * parity — you think in dollars, not coins), and "Add to position" opens pinned
 * to the position's side. Everything else is identical, which is what lets the
 * Simple and Pro tickets share this one hook.
 */
function initialForm(options: UseOrderEntryOptions | undefined): OrderEntryFormState {
  return {
    ...INITIAL_FORM,
    sizeUnit: options?.initialSizeUnit ?? INITIAL_FORM.sizeUnit,
    side: options?.initialSide ?? INITIAL_FORM.side,
  }
}

const ALL_TOUCHED: OrderEntryTouched = {
  size: true,
  price: true,
  stopPrice: true,
  slippage: true,
  twapDuration: true,
}

const COIN_SIZE_DECIMALS = 6

/** Round a coin size to a market's lot precision (`szDecimals`). The slider must
 *  emit a size no finer than the active market's lot step, or the venue's
 *  lot-step validator rejects an otherwise-valid slider position (L1). */
function roundToSzDecimals(value: number, szDecimals: number): string {
  const factor = 10 ** szDecimals
  return String(Math.round(value * factor) / factor)
}

function parseFiniteNumber(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

/** A price (mid/mark) → input string for the limit/stop price field. Drops
 *  trailing zeros; '' for a non-positive price so the MID chip never fills 0. */
const PRICE_INPUT_DECIMALS = 6
function formatPriceInput(price: number): string {
  if (!(price > 0)) return ''
  const factor = 10 ** PRICE_INPUT_DECIMALS
  return String(Math.round(price * factor) / factor)
}

/** Whether the active type renders the TP/SL section: venue trigger support AND
 *  a market/limit order (stop/twap never carry entry protection — IA gating). */
function computeProtectionApplicable(orderType: OrderType, supportsTriggerOrders: boolean): boolean {
  const isMarketOrLimit = orderType === 'market' || orderType === 'limit'
  return supportsTriggerOrders && isMarketOrLimit
}

/** Assemble the venue-agnostic `OrderDraft` the venue parses + prices. Raw form
 *  strings cross the port verbatim ("parse, don't validate"); the derived fields
 *  are the leverage selection `trading/` owns and the market the ticket targets
 *  (`symbol`) — the venue resolves all per-market data from it (ADR-0057). */
function toDraft(form: OrderEntryFormState, symbol: string, leverage: number): OrderDraft {
  return {
    symbol,
    orderType: form.orderType,
    side: form.side,
    sizeUnit: form.sizeUnit,
    sizeInput: form.sizeInput,
    priceInput: form.priceInput,
    stopPriceInput: form.stopPriceInput,
    slippageInput: form.slippageInput,
    timeInForce: form.timeInForce,
    twapHoursInput: form.twapHoursInput,
    twapMinutesInput: form.twapMinutesInput,
    randomize: form.randomize,
    reduceOnly: form.reduceOnly,
    leverage,
  }
}

/** The venue issues for one field (empty when the field is clean). */
function issuesForField(issues: ReadonlyArray<OrderIssue>, field: OrderField): OrderIssue[] {
  return issues.filter((issue) => issue.field === field)
}

/** Drop fields that are not valid for the new order type (IA field-set swap
 *  rule: a stale stop price must never reach `placeOrder`). Size persists. */
function clearInvalidFields(previous: OrderEntryFormState, orderType: OrderType): OrderEntryFormState {
  const keepsLimitPrice = orderType === 'limit' || orderType === 'stop-limit'
  const keepsStopPrice = orderType === 'stop-market' || orderType === 'stop-limit'
  const keepsSlippage = orderType === 'market' || orderType === 'stop-market'
  const keepsTif = orderType === 'limit'
  const isTwap = orderType === 'twap'
  return {
    ...previous,
    orderType,
    priceInput: keepsLimitPrice ? previous.priceInput : '',
    stopPriceInput: keepsStopPrice ? previous.stopPriceInput : '',
    slippageInput: keepsSlippage ? previous.slippageInput : '',
    timeInForce: keepsTif ? previous.timeInForce : 'Gtc',
    twapHoursInput: isTwap ? previous.twapHoursInput : DEFAULT_TWAP_HOURS,
    twapMinutesInput: isTwap ? previous.twapMinutesInput : DEFAULT_TWAP_MINUTES,
    randomize: isTwap ? previous.randomize : false,
  }
}

/** Reset the ticket after a successful placement: the entered values clear
 *  (size, price, stop, slippage) so the next order starts blank, while the
 *  sticky selections the trader keeps between orders persist (order type, side,
 *  size unit, time-in-force, TWAP randomize). The TWAP duration returns to its
 *  default with the rest of the type's transient fields. The protection draft
 *  and per-field touched state are reset by the caller. */
function resetAfterSubmit(previous: OrderEntryFormState): OrderEntryFormState {
  return {
    ...previous,
    sizeInput: DEFAULT_SIZE,
    priceInput: DEFAULT_PRICE,
    stopPriceInput: '',
    slippageInput: '',
    twapHoursInput: DEFAULT_TWAP_HOURS,
    twapMinutesInput: DEFAULT_TWAP_MINUTES,
  }
}

/** Apply a suggestion prefill patch (#213) to the form: a directional outcome
 *  always seeds a limit entry — side + limit price. Other form fields keep their
 *  current values (the user fills size). The patch's TP/SL legs are applied to
 *  the protection draft separately (`applyIntentToProtection`). */
function applyIntentToForm(
  previous: OrderEntryFormState,
  intent: OrderIntent,
): OrderEntryFormState {
  return {
    ...previous,
    side: intent.patch.side,
    orderType: intent.patch.orderType,
    priceInput: intent.patch.priceInput,
  }
}

/** Apply a suggestion prefill patch's TP/SL legs (#213) to the protection draft.
 *  A leg is set by its trigger price (price-anchored); the coupled gain/loss is
 *  re-derived by the hook's live-context recouple. The section is enabled when
 *  the patch carries at least one leg. */
function applyIntentToProtection(
  previous: EntryProtectionDraft,
  intent: OrderIntent,
): EntryProtectionDraft {
  const takeProfitPriceInput = intent.patch.takeProfitPriceInput
  const stopLossPriceInput = intent.patch.stopLossPriceInput
  const hasTakeProfit = takeProfitPriceInput !== undefined
  const hasStopLoss = stopLossPriceInput !== undefined
  const hasAnyLeg = hasTakeProfit || hasStopLoss
  return {
    ...previous,
    enabled: hasAnyLeg || previous.enabled,
    takeProfit: hasTakeProfit
      ? { priceInput: takeProfitPriceInput, amountInput: '' }
      : previous.takeProfit,
    stopLoss: hasStopLoss
      ? { priceInput: stopLossPriceInput, amountInput: '' }
      : previous.stopLoss,
  }
}

/** The reference price the order's protection projects off: the limit or stop
 *  price when set, else the mark price. (`trading/`-owned trivial selection.) */
function referencePriceFor(form: OrderEntryFormState, markPrice: number): number {
  const limitPrice = parseFiniteNumber(form.priceInput) ?? 0
  const stopPrice = parseFiniteNumber(form.stopPriceInput) ?? 0
  if (limitPrice > 0) return limitPrice
  if (stopPrice > 0) return stopPrice
  return markPrice
}

/** Re-couple one protection leg against a fresh context, holding the user's
 *  anchor fixed: a price-anchored leg keeps its trigger and re-derives the
 *  gain/loss; an amount-anchored leg keeps its gain/loss and re-derives the
 *  trigger. An empty leg passes through unchanged. */
function recoupleLeg(
  leg: ProtectionLegKind,
  draft: ProtectionLegDraft,
  context: ProtectionContext,
  basis: ProtectionBasis,
): ProtectionLegDraft {
  if (!isLegPopulated(draft)) return draft
  const triggerContext = { ...context, basis, kind: triggerKindFor(leg) }
  const hasExplicitPrice = draft.priceInput.trim().length > 0
  if (hasExplicitPrice) return coupleFromPriceInput(draft.priceInput, triggerContext)
  return coupleFromAmountInput(draft.amountInput, triggerContext)
}

/** Re-derive both legs' coupled figures against a fresh context (live size /
 *  reference price). Keeps the section flags + basis; only the coupled values
 *  move. Used when leverage / amount change shifts the derived TP/SL (L3). */
function recoupleProtection(
  protection: EntryProtectionDraft,
  context: ProtectionContext,
): EntryProtectionDraft {
  const takeProfit = recoupleLeg('takeProfit', protection.takeProfit, context, protection.basis)
  const stopLoss = recoupleLeg('stopLoss', protection.stopLoss, context, protection.basis)
  return { ...protection, takeProfit, stopLoss }
}

/**
 * Project the venue issue set + per-field touched state into the presentation
 * `OrderEntryValidation`. The four inline `isValid` props mark a field invalid
 * only once it is touched (D-6 — a half-typed form must not scream "required");
 * `canSubmit` gates on the FULL issue set regardless of touched (plus the
 * `trading/`-owned TP/SL legs).
 *
 * Both the "size > 0" and the min-notional ($10) rules are `field: 'size'`
 * issues (the flat `OrderField` taxonomy, D-9). `trading/` keeps the two
 * concerns visually distinct exactly as before: the size-field border
 * (`isSizeValid`) reflects only the trivial "is the entered size positive"
 * presentation fact, while a size issue raised against an otherwise-positive
 * size surfaces as the separate min-order-value hint (`isOrderValueValid`).
 */
function projectValidation(
  issues: ReadonlyArray<OrderIssue>,
  touched: OrderEntryTouched,
  isSizePositive: boolean,
  isProtectionLegsValid: boolean,
): OrderEntryValidation {
  const hasSizeIssue = issuesForField(issues, 'size').length > 0
  const hasPriceIssue = issuesForField(issues, 'price').length > 0
  const hasStopIssue = issuesForField(issues, 'stopPrice').length > 0
  const hasSlippageIssue = issuesForField(issues, 'slippage').length > 0
  const hasTwapIssue = issuesForField(issues, 'twapDuration').length > 0

  // Border reflects size-positivity only; a positive size with a remaining size
  // issue is the min-notional case → border stays valid, the hint shows.
  const isSizeValid = !touched.size || isSizePositive
  const isOrderValueValid = !isSizePositive || !hasSizeIssue
  const isPriceValid = !touched.price || !hasPriceIssue
  const isStopPriceValid = !touched.stopPrice || !hasStopIssue
  const isSlippageValid = !touched.slippage || !hasSlippageIssue
  const isTwapDurationValid = !touched.twapDuration || !hasTwapIssue

  const hasNoVenueIssues = issues.length === 0
  const canSubmit = hasNoVenueIssues && isProtectionLegsValid
  return {
    isSizeValid,
    isPriceValid,
    isStopPriceValid,
    isTwapDurationValid,
    isProtectionValid: isProtectionLegsValid,
    isOrderValueValid,
    isSlippageValid,
    canSubmit,
  }
}

export function useOrderEntry(options?: UseOrderEntryOptions): UseOrderEntryReturn {
  const traderCap = useCapability('trader')
  // Available-to-Trade / spot sizing / Current-Position read the ACTING account
  // group so they reflect the User's own account while Spectating, matching the
  // venue's self-keyed validation/preview holders (ADR-0038 D-1). The dock /
  // portfolio keep reading the viewing capabilities.
  const portfolioCap = useOwnCapability('portfolio')
  const balancesCap = useOwnCapability('balances')
  const positionsCap = useOwnCapability('perpsPositionsSnapshot')
  const { selectedMarket, market } = useSelectedMarketContext()
  const { leverage } = useLeverageMargin()
  const { pending: pendingIntent } = useOrderIntent()
  const { isSpectating, stopSpectating } = useSpectate()
  const [form, setForm] = useState<OrderEntryFormState>(() => initialForm(options))
  const [touched, setTouched] = useState<OrderEntryTouched>(INITIAL_TOUCHED)
  const [protection, setProtection] = useState<EntryProtectionDraft>(INITIAL_ENTRY_PROTECTION)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [availableMargin, setAvailableMargin] = useState(0)
  const [spotUsdcAvailable, setSpotUsdcAvailable] = useState(0)
  const [spotBaseAvailable, setSpotBaseAvailable] = useState(0)
  const [currentPositionSize, setCurrentPositionSize] = useState(0)

  const supportsTriggerOrders = traderCap.supportsTriggerOrders ?? false
  const supportsStopOrders = traderCap.supportsStopOrders ?? false
  const supportsTwap = traderCap.supportsTwap ?? false

  // Live mark from the venue ticker stream — drives the MID button, the
  // protection reference, and the coin⇄USD display. The venue's `previewOrder`
  // reads its own live-mark cache internally (fed by this same subscription —
  // no duplicate stream; S8 × S2). Seeded from `market.markPrice` until the
  // first tick. See `use-live-mark.ts` / ADR-0035 D-4.
  const markPrice = useLiveMark(selectedMarket, market.markPrice ?? 0)

  // Spot has no leverage (always 1×) and no shorting; perp/HIP-3 use the live
  // per-symbol leverage. `marketType` absent ⇒ treat as perp (legacy markets).
  const isSpot = market.marketType === 'spot'
  // HIP-3 (builder-deployed) markets have isolated per-DEX collateral; a default
  // account must opt into cross-DEX abstraction before it can trade them, which
  // the order-entry HIP-3 gate handles (ADR-0081).
  const isHip3 = market.marketType === 'hip3'
  const effectiveLeverage = isSpot ? 1 : leverage
  const isBuy = form.side === 'buy'
  // The active market's lot precision (`szDecimals`, recovered from `stepSize =
  // 10^-szDecimals`). The slider rounds its coin size to this so a valid slider
  // position never emits a size the venue's lot-step validator rejects (L1).
  const sizeLotDecimals = specFromMarket(market).szDecimals

  // Available-to-Trade / Current-Position readouts are display values, sourced
  // from the same capability streams as before. The venue owns the *capacity*
  // (maxCoinSize) the slider sizes off; these only label the info rows.
  useEffect(() => {
    if (!portfolioCap) return
    // 'perps' scope = perp-tradeable collateral in both account modes (S7 / bug
    // #1; ADR-0033 D-4). See hyperliquid-account-modes.md §3.
    return portfolioCap.subscribeSnapshot('perps', (snapshot) => {
      setAvailableMargin(snapshot.accountValue)
    })
  }, [portfolioCap])

  useEffect(() => {
    if (!balancesCap || !isSpot) return
    return balancesCap.subscribe('all', (balances) => {
      let usdc = 0
      let base = 0
      for (const balance of balances) {
        const isSpotPool = balance.source === 'spot' || balance.source === 'unified'
        if (!isSpotPool) continue
        if (balance.asset === 'USDC') usdc = balance.available
        else if (balance.asset === market.baseAsset) base = balance.available
      }
      setSpotUsdcAvailable(usdc)
      setSpotBaseAvailable(base)
    })
  }, [balancesCap, isSpot, market.baseAsset])

  useEffect(() => {
    if (!positionsCap) return
    return positionsCap.subscribe((positions) => {
      const match = positions.find((position) => position.symbol === selectedMarket)
      if (match === undefined) {
        setCurrentPositionSize(0)
        return
      }
      const signedSize = match.side === 'short' ? -match.size : match.size
      setCurrentPositionSize(signedSize)
    })
  }, [positionsCap, selectedMarket])

  const draft = useMemo(
    () => toDraft(form, selectedMarket, effectiveLeverage),
    [form, selectedMarket, effectiveLeverage],
  )

  // Venue-owned parse + validation (D-1): the Ok payload is the typed request
  // fed straight to `placeOrder`. Re-run every keystroke (synchronous).
  const validateResult = useMemo(() => traderCap.validateDraft(draft), [traderCap, draft])
  const venueIssues = useMemo<ReadonlyArray<OrderIssue>>(
    () => (validateResult.isErr() ? validateResult.error : []),
    [validateResult],
  )

  // Venue-owned estimates + capacity (D-4). The % slider / MAX size off
  // `capacity.maxCoinSize`; the footer renders `estimates`.
  const preview = useMemo(() => traderCap.previewOrder(draft), [traderCap, draft])
  const estimates = preview.estimates as PreTradeEstimates
  const maxCoinSize = preview.capacity.maxCoinSize

  // Spot orders carry no attached TP/SL (the legs assume a position) — gate off.
  const isProtectionApplicable = computeProtectionApplicable(form.orderType, supportsTriggerOrders) && !isSpot
  const protectionReferencePrice = referencePriceFor(form, markPrice)
  // Protection size (coin) is derived from the venue estimate's notional, not a
  // re-implemented size-conversion (the venue owns that math now).
  const protectionSizeCoin = useMemo(() => {
    const isLinear = estimates.kind === 'linear'
    if (!isLinear || markPrice <= 0) return 0
    return estimates.notional / markPrice
  }, [estimates, markPrice])

  const isProtectionLegsValid =
    !isProtectionApplicable ||
    isProtectionValid(protection, {
      side: form.side,
      referencePrice: protectionReferencePrice,
      size: protectionSizeCoin,
    })

  const isSizePositive = useMemo(() => {
    const sizeValue = parseFiniteNumber(form.sizeInput)
    return sizeValue !== null && sizeValue > 0
  }, [form.sizeInput])

  const validation = useMemo(
    () => projectValidation(venueIssues, touched, isSizePositive, isProtectionLegsValid),
    [venueIssues, touched, isSizePositive, isProtectionLegsValid],
  )

  const protectionContext = useMemo<ProtectionContext>(
    () => ({ side: form.side, referencePrice: protectionReferencePrice, size: protectionSizeCoin }),
    [form.side, protectionReferencePrice, protectionSizeCoin],
  )
  const protectionBasis = protection.basis

  // The displayed TP/SL gain/loss is derived off the live position size. When
  // leverage or the entered amount changes (moving `protectionSizeCoin` or the
  // reference price), the stored derived figures go stale — recompute each
  // populated leg's coupled field off the current context (L3). A price-anchored
  // leg holds its trigger and re-derives the gain/loss; an amount-anchored leg
  // holds its gain/loss and re-derives the trigger. Render-time previous-context
  // tracker (React 19 idiom — no setState in an effect).
  const protectionContextKey = `${protectionContext.side}|${protectionContext.referencePrice}|${protectionContext.size}`
  const [lastProtectionContextKey, setLastProtectionContextKey] = useState(protectionContextKey)
  if (lastProtectionContextKey !== protectionContextKey) {
    setLastProtectionContextKey(protectionContextKey)
    setProtection((previous) => recoupleProtection(previous, protectionContext))
  }

  const setProtectionLegPrice = useCallback(
    (leg: ProtectionLegKind, priceInput: string) => {
      const next = coupleFromPriceInput(priceInput, {
        ...protectionContext,
        basis: protectionBasis,
        kind: triggerKindFor(leg),
      })
      setProtection((previous) => ({ ...previous, [leg]: next }))
    },
    [protectionContext, protectionBasis],
  )

  const setProtectionLegAmount = useCallback(
    (leg: ProtectionLegKind, amountInput: string) => {
      const next = coupleFromAmountInput(amountInput, {
        ...protectionContext,
        basis: protectionBasis,
        kind: triggerKindFor(leg),
      })
      setProtection((previous) => ({ ...previous, [leg]: next }))
    },
    [protectionContext, protectionBasis],
  )

  const setProtectionEnabled = useCallback((enabled: boolean) => {
    setProtection((previous) => ({ ...previous, enabled }))
  }, [])

  const setProtectionBasis = useCallback(
    (basis: ProtectionBasis) => {
      setProtection((previous) => reprojectProtectionToBasis(previous, protectionContext, basis))
    },
    [protectionContext],
  )

  // A market switch must fully reset the ticket — no value from the previous
  // market leaks into the next order (L2). Resetting the entire form to initial
  // state folds in the old perp→spot Pro-type clear (spot can't carry Pro types,
  // and `INITIAL_FORM.orderType === 'market'`). Render-time previous-identity
  // tracker (React 19 idiom — the compiler forbids setState in an effect;
  // mirrors the book-trade-controls reset).
  const [activeMarketSymbol, setActiveMarketSymbol] = useState(selectedMarket)
  if (activeMarketSymbol !== selectedMarket) {
    setActiveMarketSymbol(selectedMarket)
    setForm(initialForm(options))
    setTouched(INITIAL_TOUCHED)
    setProtection(INITIAL_ENTRY_PROTECTION)
  }

  // Assisted-prefill (#213): a Directional suggestion published to the order
  // intent bus prefills the ticket — side + limit entry + TP/SL — for the active
  // market. Applied ONCE per distinct intent (a render-time identity tracker —
  // React 19 idiom, no setState in an effect) so a re-render never reverts the
  // user's subsequent edits. The patch is bound to a symbol; a stale intent for a
  // different market is ignored. Leverage is applied separately by the publisher
  // (the sheet) via `LeverageController.setLeverage` — it is NEVER an order
  // field. The user always confirms: this prefills only, never places an order.
  const [appliedIntent, setAppliedIntent] = useState<OrderIntent | null>(null)
  const isNewIntent = pendingIntent !== null && pendingIntent !== appliedIntent
  const isIntentForActiveMarket = pendingIntent?.patch.symbol === selectedMarket
  const shouldApplyIntent = isNewIntent && isIntentForActiveMarket
  if (isNewIntent) {
    // Record even an off-market intent so it is not re-evaluated each render.
    setAppliedIntent(pendingIntent)
  }
  if (shouldApplyIntent) {
    setForm((previous) => applyIntentToForm(previous, pendingIntent))
    setProtection((previous) => applyIntentToProtection(previous, pendingIntent))
  }

  // Size as a fraction (0–1) of max capacity — drives the % slider position.
  // Back-computed from the entered size so typing moves the slider too.
  const sizeFraction = useMemo(() => {
    // Both estimate kinds now carry `notional`, so the slider back-computes the
    // coin size for a TWAP draft too (the bug: TWAP estimates lacked `notional`,
    // so the slider was stuck at 0%).
    const hasCapacity = Number.isFinite(maxCoinSize) && maxCoinSize > 0
    if (!hasCapacity || markPrice <= 0) return 0
    const coinSize = estimates.notional / markPrice
    const fraction = coinSize / maxCoinSize
    if (!Number.isFinite(fraction)) return 0
    return Math.min(Math.max(fraction, 0), 1)
  }, [estimates, markPrice, maxCoinSize])

  // Available-to-trade figure + its unit, shown above the size field. Spot sell
  // reports base holdings (coin); everything else is a USD figure.
  const availableToTrade = isSpot ? (isBuy ? spotUsdcAvailable : spotBaseAvailable) : availableMargin
  const availableUnit: AvailableUnit = isSpot && !isBuy ? 'coin' : 'usd'

  // The min-order-value hint — the venue's size-tagged issue message, shown when
  // the size parses to a positive number but a size issue remains (the $10 case,
  // not the empty-size one). Rendered verbatim (D-3). Mirrors `isOrderValueValid`.
  const minOrderValueHint = useMemo(() => {
    if (validation.isOrderValueValid) return null
    return issuesForField(venueIssues, 'size')[0]?.message ?? null
  }, [validation.isOrderValueValid, venueIssues])

  // The slippage inline error — the venue's slippage-tagged issue message, shown
  // only once the field is touched. Rendered verbatim (D-3).
  const slippageHint = useMemo(() => {
    if (!touched.slippage) return null
    return issuesForField(venueIssues, 'slippage')[0]?.message ?? null
  }, [touched.slippage, venueIssues])

  const setOrderType = useCallback((orderType: OrderType) => {
    setForm((previous) => clearInvalidFields(previous, orderType))
  }, [])

  const setSide = useCallback((side: Side) => {
    setForm((previous) => ({ ...previous, side }))
  }, [])

  const setSizeInput = useCallback((sizeInput: string) => {
    setTouched((previous) => ({ ...previous, size: true }))
    setForm((previous) => ({ ...previous, sizeInput }))
  }, [])

  // Toggling the unit converts the typed value so the underlying order is held
  // fixed (coin ⇄ margin). Empty/invalid input passes through untouched. The
  // conversion math is trivial and trading-owned (display concern, not a venue
  // order rule): coin→margin renders the collateral, margin→coin the position.
  const setSizeUnit = useCallback(
    (sizeUnit: SizeUnit) => {
      setForm((previous) => ({
        ...previous,
        sizeUnit,
        sizeInput: convertSizeInput(previous.sizeInput, previous.sizeUnit, sizeUnit, markPrice, effectiveLeverage),
      }))
    },
    [markPrice, effectiveLeverage],
  )

  const setSizeFromBuyingPowerFraction = useCallback(
    (fraction: number) => {
      setTouched((previous) => ({ ...previous, size: true }))
      const coinSize = maxCoinSize * fraction
      const isUsdUnit = form.sizeUnit === 'usd'
      // USD mode renders the margin (collateral) the fraction commits, not the
      // notional — margin = (coin × price) / leverage. At 1× (spot) this is the
      // USDC spent. Coin mode emits the coin size directly.
      // USD/quote path: margin is a 2-dp figure `coinToMargin` already rounds —
      // leave it untouched. Coin path: round to the market's lot precision so
      // the slider never emits a size the lot-step validator rejects (L1).
      const nextValue = isUsdUnit
        ? String(coinToMargin(coinSize, effectiveLeverage, markPrice))
        : roundToSzDecimals(coinSize, sizeLotDecimals)
      setForm((previous) => ({ ...previous, sizeInput: nextValue }))
    },
    [maxCoinSize, form.sizeUnit, markPrice, effectiveLeverage, sizeLotDecimals],
  )

  const setPriceInput = useCallback((priceInput: string) => {
    setTouched((previous) => ({ ...previous, price: true }))
    setForm((previous) => ({ ...previous, priceInput }))
  }, [])

  const setPriceFromMid = useCallback(() => {
    const midInput = formatPriceInput(markPrice)
    if (midInput.length === 0) return
    setForm((previous) => ({ ...previous, priceInput: midInput }))
  }, [markPrice])

  const setStopPriceInput = useCallback((stopPriceInput: string) => {
    setTouched((previous) => ({ ...previous, stopPrice: true }))
    setForm((previous) => ({ ...previous, stopPriceInput }))
  }, [])

  const setStopPriceFromMid = useCallback(() => {
    const midInput = formatPriceInput(markPrice)
    if (midInput.length === 0) return
    setForm((previous) => ({ ...previous, stopPriceInput: midInput }))
  }, [markPrice])

  const setSlippageInput = useCallback((slippageInput: string) => {
    setTouched((previous) => ({ ...previous, slippage: true }))
    setForm((previous) => ({ ...previous, slippageInput }))
  }, [])

  const setReduceOnly = useCallback((reduceOnly: boolean) => {
    setForm((previous) => ({ ...previous, reduceOnly }))
  }, [])

  const setTimeInForce = useCallback((timeInForce: OrderTimeInForce) => {
    setForm((previous) => ({ ...previous, timeInForce }))
  }, [])

  const setTwapHours = useCallback((twapHoursInput: string) => {
    setTouched((previous) => ({ ...previous, twapDuration: true }))
    setForm((previous) => ({ ...previous, twapHoursInput }))
  }, [])

  const setTwapMinutes = useCallback((twapMinutesInput: string) => {
    setTouched((previous) => ({ ...previous, twapDuration: true }))
    setForm((previous) => ({ ...previous, twapMinutesInput }))
  }, [])

  const setRandomize = useCallback((randomize: boolean) => {
    setForm((previous) => ({ ...previous, randomize }))
  }, [])

  const submit = useCallback(() => {
    if (isSpectating) return
    // A submit attempt surfaces every field's error (D-6).
    setTouched(ALL_TOUCHED)
    if (validateResult.isErr()) return
    if (!isProtectionLegsValid) return
    if (isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)
    const clientOrderId = generateCloid(ORDER_CLOID_PREFIX)
    // The venue-validated request is the single source of truth — no re-parse.
    // `trading/` attaches its own TP/SL legs + the cloid before placing.
    const attachedProtection = isProtectionApplicable
      ? buildEntryProtection(protection, {
          side: form.side,
          referencePrice: protectionReferencePrice,
          size: protectionSizeCoin,
        })
      : {}
    const request: PlaceOrderRequest = { ...validateResult.value, ...attachedProtection, clientOrderId }
    toast.show(buildPendingOrderToast(clientOrderId, form.side, selectedMarket))
    traderCap.placeOrder(request).match(
      (outcome) => {
        setIsSubmitting(false)
        toast.show(buildOutcomeToast(clientOrderId, selectedMarket, outcome))
        // Clear the ticket for the next order: entry fields reset, sticky
        // selections (type/side/unit/TIF/randomize) persist.
        setForm(resetAfterSubmit)
        setTouched(INITIAL_TOUCHED)
        setProtection(INITIAL_ENTRY_PROTECTION)
      },
      (error) => {
        setIsSubmitting(false)
        setErrorMessage(placeOrderErrorMessage(error))
        toast.show(buildOrderErrorToast(clientOrderId, error))
      },
    )
  }, [
    traderCap,
    validateResult,
    isProtectionApplicable,
    isProtectionLegsValid,
    protection,
    protectionReferencePrice,
    protectionSizeCoin,
    form.side,
    isSubmitting,
    selectedMarket,
    isSpectating,
  ])

  useEffect(() => {
    if (!isSpectating) return
    const onKeyDown = (event: KeyboardEvent) => {
      const isHotkeyChord = event.ctrlKey && event.key.toLowerCase() === STOP_SPECTATING_HOTKEY
      if (!isHotkeyChord) return
      event.preventDefault()
      stopSpectating()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSpectating, stopSpectating])

  return {
    form,
    validation,
    isSubmitting,
    errorMessage,
    isSpectating,
    markPrice,
    availableToTrade,
    availableUnit,
    isSpot,
    isHip3,
    minOrderValueHint,
    slippageHint,
    currentPositionSize,
    sizeFraction,
    estimates,
    supportsTriggerOrders,
    supportsStopOrders,
    supportsTwap,
    isProtectionApplicable,
    protection,
    setOrderType,
    setSide,
    setSizeInput,
    setSizeUnit,
    setSizeFromBuyingPowerFraction,
    setPriceInput,
    setPriceFromMid,
    setStopPriceInput,
    setStopPriceFromMid,
    setProtectionEnabled,
    setProtectionBasis,
    setProtectionLegPrice,
    setProtectionLegAmount,
    setSlippageInput,
    setReduceOnly,
    setTimeInForce,
    setTwapHours,
    setTwapMinutes,
    setRandomize,
    submit,
    stopSpectating,
  }
}

/** Coin position size → margin (collateral): margin = (coin × price) / leverage.
 *  Display-only conversion for the size-unit toggle (the venue owns order
 *  sizing). Returns 0 for a non-positive leverage / mark price. */
const USD_DECIMALS = 2
function coinToMargin(coinSize: number, leverage: number, markPrice: number): number {
  if (!(leverage > 0) || !(markPrice > 0)) return 0
  const factor = 10 ** USD_DECIMALS
  return Math.round(((coinSize * markPrice) / leverage) * factor) / factor
}

/** Margin (collateral) → coin position size: coin = (margin × leverage) / price.
 *  Inverse of `coinToMargin`. Returns 0 for a non-positive mark price. */
function marginToCoin(margin: number, leverage: number, markPrice: number): number {
  if (!(markPrice > 0)) return 0
  const factor = 10 ** COIN_SIZE_DECIMALS
  return Math.round(((margin * leverage) / markPrice) * factor) / factor
}

/** Convert a freshly-typed amount when the size-unit toggle flips, holding the
 *  underlying order fixed. coin→usd renders the position's margin; usd→coin the
 *  coin the margin buys. An empty/unparseable field passes through untouched. */
function convertSizeInput(
  sizeInput: string,
  fromUnit: SizeUnit,
  toUnit: SizeUnit,
  markPrice: number,
  leverage: number,
): string {
  if (fromUnit === toUnit) return sizeInput
  const enteredSize = parseFiniteNumber(sizeInput)
  if (enteredSize === null) return sizeInput
  const isToUsd = toUnit === 'usd'
  const converted = isToUsd
    ? coinToMargin(enteredSize, leverage, markPrice)
    : marginToCoin(enteredSize, leverage, markPrice)
  return String(converted)
}
