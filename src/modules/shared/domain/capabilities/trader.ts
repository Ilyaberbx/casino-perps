import type { Result, ResultAsync } from 'neverthrow'
import type {
  ModifyOrderRequest,
  OrderCapacity,
  OrderDraft,
  OrderEstimates,
  OrderIssue,
  OrderIdentifier,
  PlaceOrderOutcome,
  PlaceOrderRequest,
} from '../domain.types'

/**
 * `rejected` carries a venue rejection that arrived under an otherwise-`ok`
 * envelope (e.g. a per-order error in Hyperliquid's `statuses[]`). The raw
 * reason is passed through in `message` — no friendly-copy mapping in this
 * version (PRD decision 5).
 */
export type PlaceOrderErrorKind =
  | 'invalid-size'
  | 'invalid-price'
  | 'unknown-symbol'
  | 'book-empty'
  | 'rejected'
  /** The venue does not support the requested order type (e.g. a stop / TWAP
   *  order placed against an adapter whose `supportsStopOrders` / `supportsTwap`
   *  flag is unset). See ADR-0034. */
  | 'unsupported-order-type'

export class PlaceOrderError extends Error {
  readonly kind: PlaceOrderErrorKind
  constructor(kind: PlaceOrderErrorKind, message: string) {
    super(message)
    this.name = 'PlaceOrderError'
    this.kind = kind
  }
}

export type CancelOrderErrorKind = 'not-found' | 'rejected'

export class CancelOrderError extends Error {
  readonly kind: CancelOrderErrorKind
  constructor(kind: CancelOrderErrorKind, message: string) {
    super(message)
    this.name = 'CancelOrderError'
    this.kind = kind
  }
}

export type ModifyOrderErrorKind = 'not-found' | 'invalid-size' | 'invalid-price' | 'rejected'

export class ModifyOrderError extends Error {
  readonly kind: ModifyOrderErrorKind
  constructor(kind: ModifyOrderErrorKind, message: string) {
    super(message)
    this.name = 'ModifyOrderError'
    this.kind = kind
  }
}

/**
 * Place / modify / cancel orders. `modifyOrder` is optional so a venue can
 * support place+cancel without in-place modify; the UI gates the Modify
 * affordance on its presence. `placeOrder` returns a discriminated
 * `PlaceOrderOutcome`; per-order venue rejections come back as a `rejected`
 * `PlaceOrderError`. Close = `placeOrder` reduce-only (no separate port).
 */
export interface Trader {
  /**
   * Whether the venue accepts entry-attached take-profit / stop-loss legs
   * (`takeProfit` / `stopLoss` on the place-order request). The UI gates the
   * entry TP/SL section on this flag — a venue that places orders but cannot
   * attach triggers (e.g. Extended) sets it `false`/absent and the section is
   * not rendered. Absent ⇒ treated as unsupported.
   */
  readonly supportsTriggerOrders?: boolean
  /**
   * Whether the venue accepts stop orders (`stop-market` / `stop-limit`
   * `PlaceOrderRequest` variants). The Pro order-type dropdown lists Stop Market
   * / Stop Limit only when this flag is set. Absent ⇒ treated as unsupported;
   * the variants resolve to an `unsupported-order-type` `PlaceOrderError`.
   * See ADR-0034 D-2.
   */
  readonly supportsStopOrders?: boolean
  /**
   * Whether the venue accepts TWAP orders (the `twap` `PlaceOrderRequest`
   * variant). The Pro order-type dropdown lists TWAP only when this flag is set.
   * Absent ⇒ treated as unsupported; the variant resolves to an
   * `unsupported-order-type` `PlaceOrderError`. See ADR-0034 D-2.
   */
  readonly supportsTwap?: boolean
  placeOrder(request: PlaceOrderRequest): ResultAsync<PlaceOrderOutcome, PlaceOrderError>
  modifyOrder?(request: ModifyOrderRequest): ResultAsync<PlaceOrderOutcome, ModifyOrderError>
  cancelOrder(identifier: OrderIdentifier): ResultAsync<void, CancelOrderError>
  /**
   * Parse + validate a raw-string `OrderDraft`. **Synchronous** (called every
   * keystroke). On success the parsed `PlaceOrderRequest` is the single source
   * of truth fed straight to `placeOrder` — `trading/` does not re-parse. On
   * failure it returns the full set of field-tagged `OrderIssue`s. Mandatory
   * whenever `trader` is present (read-only venues expose no `trader`, so there
   * is no fallback path). One parser per venue, shared between this pre-check
   * and `placeOrder`, so the client pre-check can never drift from the venue's
   * own acceptance. See ADR-0035 D-1 / D-2 / D-5.
   */
  validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]>
  /**
   * Live pre-trade estimates + capacity for a draft. **Synchronous**. The venue
   * pulls mark price / taker rate / margin model internally; `capacity` is the
   * single source the % slider / MAX sizes off. Mandatory whenever `trader` is
   * present. See ADR-0035 D-1 / D-4 / D-5.
   */
  previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity }
}
