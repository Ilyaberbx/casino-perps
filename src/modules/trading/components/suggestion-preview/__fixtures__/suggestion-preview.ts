import { ok, err, okAsync, errAsync } from 'neverthrow'
import { PlaceOrderError } from '@/modules/shared/domain'
import type {
  OrderDraft,
  OrderIssue,
  PlaceOrderOutcome,
  PlaceOrderRequest,
  Trader,
} from '@/modules/shared/domain'
import type {
  RawSuggestion,
  StoredSuggestion,
  SuggestionParams,
} from '../../../api/suggestions.types'

/**
 * Builders for the suggestion-preview slice-10 tests. The fake `Trader` returns
 * `Result`/`ResultAsync` from neverthrow exactly like a real venue capability,
 * so the hook's `validateDraft` re-validation and `placeOrder` paths exercise
 * real control flow. Override pieces via the partials.
 */

export function makeRawSuggestion(overrides: Partial<RawSuggestion> = {}): RawSuggestion {
  return {
    side: 'long',
    confidence: 72,
    entryPrice: 60000,
    stopLossPrice: 58000,
    takeProfitPrice: 65000,
    reasons: ['Momentum is positive', 'Funding favours longs'],
    risks: ['Macro print on Friday'],
    ...overrides,
  }
}

export function makeSuggestionParams(
  overrides: Partial<SuggestionParams> = {},
): SuggestionParams {
  return {
    symbol: 'BTC',
    style: 'scalping',
    marginUsd: 500,
    leverage: 5,
    ...overrides,
  }
}

/** Like `StoredSuggestion` but the nested objects accept partial overrides. */
export interface StoredSuggestionOverrides
  extends Partial<Omit<StoredSuggestion, 'rawSuggestion' | 'requestParams'>> {
  readonly rawSuggestion?: Partial<RawSuggestion>
  readonly requestParams?: Partial<SuggestionParams>
}

export function makeStoredSuggestion(
  overrides: StoredSuggestionOverrides = {},
): StoredSuggestion {
  const { rawSuggestion, requestParams, ...rest } = overrides
  return {
    id: 'sug-1',
    agentId: 'minara',
    requestParams: makeSuggestionParams(requestParams),
    rawSuggestion: makeRawSuggestion(rawSuggestion),
    costPaidUsd: '0.25',
    createdAt: '2026-06-14T10:00:00.000Z',
    expiresAt: '2026-06-14T11:00:00.000Z',
    ...rest,
  }
}

/** A `PlaceOrderRequest` shaped value returned by a successful `validateDraft`. */
export function makePlaceOrderRequest(
  overrides: Partial<PlaceOrderRequest> = {},
): PlaceOrderRequest {
  return {
    orderType: 'limit',
    side: 'buy',
    symbol: 'BTC',
    size: 100,
    price: 60000,
    timeInForce: 'Gtc',
    ...overrides,
  } as PlaceOrderRequest
}

export function makePlaceOutcome(
  overrides: Partial<PlaceOrderOutcome> = {},
): PlaceOrderOutcome {
  return {
    kind: 'resting',
    orderIdentifier: 'ord-1',
    symbol: 'BTC',
    timestamp: 0,
    ...overrides,
  } as PlaceOrderOutcome
}

export interface FakeTraderOptions {
  /** When set, `validateDraft` returns these issues (err) for every call. */
  readonly issues?: readonly OrderIssue[]
  /** The ok value `validateDraft` returns when not erroring. */
  readonly request?: PlaceOrderRequest
  /** When set, `placeOrder` returns this error instead of an outcome. */
  readonly placeError?: PlaceOrderError
  /** The outcome `placeOrder` returns on success. */
  readonly outcome?: PlaceOrderOutcome
  /** Spy invoked with every draft handed to `validateDraft`. */
  readonly onValidate?: (draft: OrderDraft) => void
  /** Spy invoked with every request handed to `placeOrder`. */
  readonly onPlace?: (request: PlaceOrderRequest) => void
}

/**
 * A `Trader` capability whose `validateDraft` / `placeOrder` are driven by the
 * options. `validateDraft` records each draft (so a test can assert the hook
 * re-validates on edit) and either returns the configured issues (`err`) or the
 * configured request (`ok`). `placeOrder` records each request and returns the
 * configured outcome (`okAsync`) or error (`errAsync`).
 */
export function makeFakeTrader(options: FakeTraderOptions = {}): Trader {
  const request = options.request ?? makePlaceOrderRequest()
  const outcome = options.outcome ?? makePlaceOutcome()
  return {
    supportsTriggerOrders: true,
    validateDraft(draft: OrderDraft) {
      options.onValidate?.(draft)
      if (options.issues && options.issues.length > 0) {
        return err([...options.issues])
      }
      return ok(request)
    },
    placeOrder(req: PlaceOrderRequest) {
      options.onPlace?.(req)
      if (options.placeError) return errAsync(options.placeError)
      return okAsync(outcome)
    },
    cancelOrder() {
      return okAsync(undefined)
    },
    previewOrder() {
      return {
        estimates: {
          kind: 'linear',
          notional: 0,
          margin: 0,
          liquidationPrice: 0,
          fee: 0,
          hasBuilderFee: false,
        },
        capacity: { maxCoinSize: 0 },
      }
    },
  }
}

export function makePlaceError(
  kind: PlaceOrderError['kind'] = 'rejected',
  message = 'Venue rejected the order',
): PlaceOrderError {
  return new PlaceOrderError(kind, message)
}
