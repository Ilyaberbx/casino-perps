import { useCallback, useMemo, useState } from 'react'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { useToast } from '@/modules/shared/providers/toast-provider'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'
import { logger } from '@/app/logger'
import type {
  OrderDraft,
  OrderIssue,
  PlaceOrderRequest,
  Side,
  TriggerLeg,
} from '@/modules/shared/domain'
import { useSuggestionPreviewSheet } from '../../providers/suggestion-preview-provider'
import type {
  PlaceState,
  PreviewEditState,
  UseSuggestionPreviewReturn,
} from './suggestion-preview.types'
import type { StoredSuggestion } from '../../api/suggestions.types'

const log = logger.child({ module: 'ai-suggestion-preview' })

const EMPTY_EDIT: PreviewEditState = {
  marginUsd: '',
  leverage: '',
  entry: '',
  stopLoss: '',
  takeProfit: '',
}

function seedEdit(suggestion: StoredSuggestion): PreviewEditState {
  const { rawSuggestion, requestParams } = suggestion
  return {
    marginUsd: requestParams.marginUsd !== undefined ? String(requestParams.marginUsd) : '',
    leverage: requestParams.leverage !== undefined ? String(requestParams.leverage) : '',
    entry: String(rawSuggestion.entryPrice),
    // A neutral suggestion carries no exit levels — seed blank, not `"null"`.
    stopLoss: rawSuggestion.stopLossPrice !== null ? String(rawSuggestion.stopLossPrice) : '',
    takeProfit:
      rawSuggestion.takeProfitPrice !== null ? String(rawSuggestion.takeProfitPrice) : '',
  }
}

function toDraft(edit: PreviewEditState, side: Side, symbol: string): OrderDraft {
  return {
    symbol,
    orderType: 'limit',
    side,
    sizeUnit: 'usd',
    sizeInput: edit.marginUsd,
    priceInput: edit.entry,
    stopPriceInput: '',
    slippageInput: '',
    timeInForce: 'Gtc',
    twapHoursInput: '',
    twapMinutesInput: '',
    randomize: false,
    reduceOnly: false,
    leverage: Number(edit.leverage) || 1,
  }
}

function protectionLegs(edit: PreviewEditState): {
  takeProfit?: TriggerLeg
  stopLoss?: TriggerLeg
} {
  const legs: { takeProfit?: TriggerLeg; stopLoss?: TriggerLeg } = {}
  const tp = Number(edit.takeProfit)
  if (Number.isFinite(tp) && tp > 0) {
    legs.takeProfit = { kind: 'take-profit', trigger: { type: 'price', price: tp } }
  }
  const sl = Number(edit.stopLoss)
  if (Number.isFinite(sl) && sl > 0) {
    legs.stopLoss = { kind: 'stop-loss', trigger: { type: 'price', price: sl } }
  }
  return legs
}

/**
 * The preview's OWN hook (ADR-0048 slice 10 — never extends the order-entry
 * hook). Seeds the editable legs from the raw suggestion, rebuilds an `OrderDraft`
 * each edit, and re-validates it against LIVE account state via the venue
 * `Trader.validateDraft` (+ `previewOrder`) — this is what catches "had $5 of
 * margin at request, $3 now". Places through the same `placeOrder` path the order
 * ticket uses. An expired (read-only) suggestion disables Place.
 */
export function useSuggestionPreview(): UseSuggestionPreviewReturn {
  const { target, close } = useSuggestionPreviewSheet()
  const traderCap = useCapabilityOptional('trader')
  const toast = useToast()

  const suggestion = target?.suggestion ?? null
  const readOnly = target?.readOnly ?? false
  const suggestionId = suggestion?.id ?? null

  const [edit, setEdit] = useState<PreviewEditState>(EMPTY_EDIT)
  const [place, setPlace] = useState<PlaceState>({ phase: 'idle' })
  const [seededId, setSeededId] = useState<string | null>(null)

  // Re-seed the editable legs whenever a different suggestion opens (or it
  // closes). React's adjust-state-during-render pattern — converges because
  // `seededId` catches up to `suggestionId` — so no effect, no cascading render.
  if (suggestionId !== seededId) {
    setSeededId(suggestionId)
    setEdit(suggestion ? seedEdit(suggestion) : EMPTY_EDIT)
    setPlace({ phase: 'idle' })
  }

  // A neutral ("no-trade") suggestion is non-executable: no long/short side and
  // no exit levels, so it has no order draft to place (ADR-0048 addendum).
  const isNeutral = suggestion?.rawSuggestion.side === 'neutral'
  const side: Side = suggestion?.rawSuggestion.side === 'short' ? 'sell' : 'buy'

  const validateResult = useMemo(() => {
    if (suggestion === null || !traderCap) return null
    // THE fix (ADR-0057): validate the suggestion's OWN market, not the
    // terminal's. The draft names `requestParams.symbol`, so a SOL suggestion
    // validates against SOL even while the terminal shows BTC.
    return traderCap.validateDraft(toDraft(edit, side, suggestion.requestParams.symbol))
  }, [suggestion, traderCap, edit, side])

  const issues: readonly OrderIssue[] = useMemo(() => {
    if (validateResult === null || validateResult.isOk()) return []
    return validateResult.error
  }, [validateResult])

  const isValid = validateResult !== null && validateResult.isOk()
  const canPlace =
    !readOnly &&
    !isNeutral &&
    traderCap !== undefined &&
    isValid &&
    place.phase !== 'placing'

  const onPlace = useCallback(() => {
    if (!canPlace) return
    if (!traderCap || validateResult === null || validateResult.isErr()) return
    setPlace({ phase: 'placing' })
    // Leverage travels in the draft for margin/liq pricing only; applying it to
    // the account is a separate signed action (the leverage sheet), exactly as
    // the order ticket — Place never sets leverage. See trading.types.ts.
    const request: PlaceOrderRequest = {
      ...validateResult.value,
      ...protectionLegs(edit),
    }
    traderCap.placeOrder(request).match(
      () => {
        setPlace({ phase: 'idle' })
        toast.show({ variant: 'success', title: 'Order placed' })
        close()
      },
      (error) => {
        log.warn({ kind: error.kind }, 'suggestion place failed')
        setPlace({ phase: 'error', message: error.message })
        toast.show({
          variant: 'error',
          title: 'Order failed',
          description: formatVenueErrorMessage(error.message),
        })
      },
    )
  }, [canPlace, traderCap, validateResult, edit, toast, close])

  const setMarginUsd = useCallback((marginUsd: string) => setEdit((e) => ({ ...e, marginUsd })), [])
  const setLeverage = useCallback((leverage: string) => setEdit((e) => ({ ...e, leverage })), [])
  const setEntry = useCallback((entry: string) => setEdit((e) => ({ ...e, entry })), [])
  const setStopLoss = useCallback((stopLoss: string) => setEdit((e) => ({ ...e, stopLoss })), [])
  const setTakeProfit = useCallback((takeProfit: string) => setEdit((e) => ({ ...e, takeProfit })), [])

  return {
    isOpen: suggestion !== null,
    close,
    suggestion,
    raw: suggestion?.rawSuggestion ?? null,
    readOnly,
    isNeutral,
    edit,
    setMarginUsd,
    setLeverage,
    setEntry,
    setStopLoss,
    setTakeProfit,
    issues,
    place,
    canPlace,
    onPlace,
  }
}
