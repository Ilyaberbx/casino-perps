/**
 * Type-only re-exports of @nktkas/hyperliquid response and event shapes.
 *
 * The rest of the hyperliquid/ module imports SDK types from this file rather
 * than directly from `@nktkas/hyperliquid`, so the lint zone keeps the SDK's
 * runtime surface contained to nktkas-hyperliquid-gateway.ts (and to
 * sdk-error-mapping.ts, which needs the error classes for instanceof checks).
 */
export type {
  IRequestTransport,
  ISubscription,
  ISubscriptionTransport,
  WebData2Response,
  PortfolioResponse,
  UserFeesResponse,
  ClearinghouseStateResponse,
  SpotClearinghouseStateResponse,
  DelegatorSummaryResponse,
  SpotMetaAndAssetCtxsResponse,
  SpotMetaResponse,
  BorrowLendUserStateResponse,
  UserFillsByTimeResponse,
  UserFundingResponse,
  UserBorrowLendInterestResponse,
  UserNonFundingLedgerUpdatesResponse,
  UserAbstractionResponse,
  TwapHistoryResponse,
  UserTwapSliceFillsByTimeResponse,
  HistoricalOrdersResponse,
  MetaAndAssetCtxsResponse,
  PerpDexsResponse,
  AllPerpMetasResponse,
  CandleSnapshotParameters,
  CandleSnapshotResponse,
  ActiveAssetCtxWsEvent,
  ActiveAssetCtxWsParameters,
  ActiveSpotAssetCtxWsEvent,
  CandleWsEvent,
  CandleWsParameters,
  L2BookWsEvent,
  L2BookWsParameters,
  TradesWsEvent,
  TradesWsParameters,
} from '@nktkas/hyperliquid'

/**
 * Event shape for the `allDexsClearinghouseState` subscription: clearinghouse
 * state for the main perp dex (`dex === ''`) PLUS every HIP-3 builder-deployed
 * dex, in one event. This is the SOLE source for all perp positions (main +
 * HIP-3). The SDK exports it top-level under the `WsEvent` alias; re-exported
 * here under its descriptive source name.
 */
export type { AllDexsClearinghouseStateWsEvent as AllDexsClearinghouseStateEvent } from '@nktkas/hyperliquid'

/**
 * Exchange (write) action parameter / response shapes. Re-exported from the
 * `@nktkas/hyperliquid/api/exchange` subpath so the trader adapter (outside the
 * SDK lint zone) can build and unpack order/cancel/modify payloads without
 * importing the SDK directly. Source of truth stays the SDK type.
 */
export type {
  OrderParameters,
  OrderResponse,
  OrderSuccessResponse,
  CancelParameters,
  CancelByCloidParameters,
  CancelResponse,
  CancelSuccessResponse,
  ModifyParameters,
  ModifySuccessResponse,
  UpdateLeverageParameters,
  UpdateLeverageSuccessResponse,
  TwapOrderParameters,
  TwapOrderResponse,
  TwapOrderSuccessResponse,
  TwapCancelParameters,
  TwapCancelResponse,
  TwapCancelSuccessResponse,
} from '@nktkas/hyperliquid/api/exchange'

import type {
  TwapOrderResponse as _TwapOrderResponse,
  TwapCancelResponse as _TwapCancelResponse,
} from '@nktkas/hyperliquid/api/exchange'

/**
 * The *raw* TWAP-order status union (including the `{ error }` variant). The
 * SDK's `TwapOrderSuccessResponse` strips `{ error }` from the status type, but
 * at runtime a `status:"ok"` envelope can still carry a TWAP rejection (mirrors
 * the order/cancel paths — ADR-0034 D-3). The trader adapter unpacks against
 * this wider type so the `rejected` branch is reachable and type-safe.
 */
export type HyperliquidTwapStatus = _TwapOrderResponse['response']['data']['status']

/**
 * The *raw* TWAP-cancel status union (`"success"` or `{ error }`). Like
 * {@link HyperliquidTwapStatus}, the SDK's `TwapCancelSuccessResponse` strips
 * the `{ error }` variant from the status type, but a `status:"ok"` envelope can
 * still carry a cancel rejection at runtime (ADR-0052). The twap controller
 * unpacks against this wider type so the `rejected` branch is reachable.
 */
export type HyperliquidTwapCancelStatus = _TwapCancelResponse['response']['data']['status']

import type {
  CancelResponse as _CancelResponse,
  OrderResponse as _OrderResponse,
} from '@nktkas/hyperliquid/api/exchange'

/**
 * The *raw* per-order status union (including the `{ error }` variant). The
 * SDK's `OrderSuccessResponse` strips `{ error }` from the statuses type, but
 * at runtime a `status:"ok"` envelope can still carry per-order errors (PRD
 * decision 5). The trader adapter unpacks against this wider type so the
 * `rejected` branch is reachable and type-safe.
 */
export type HyperliquidOrderStatus = _OrderResponse['response']['data']['statuses'][number]

/**
 * The *raw* per-cancel status union (including the `{ error }` variant), for the
 * same reason as {@link HyperliquidOrderStatus}: the SDK's `CancelSuccessResponse`
 * strips `{ error }` from the statuses type, but a `status:"ok"` envelope can
 * still carry a per-cancel error at runtime.
 */
export type HyperliquidCancelStatus = _CancelResponse['response']['data']['statuses'][number]

/**
 * The SDK's abstract wallet interface (viem LocalAccount / JSON-RPC account /
 * ethers signer all satisfy it). Re-exported under a venue-scoped alias so the
 * trader adapter can hold and forward the agent wallet to the exchange gateway
 * without importing the SDK directly (it only ever passes it through).
 */
export type { AbstractWallet as HyperliquidAgentWallet } from '@nktkas/hyperliquid/signing'

import type { HistoricalOrdersResponse as _HistoricalOrdersResponse } from '@nktkas/hyperliquid'
import type { ActiveAssetCtxWsEvent as _ActiveAssetCtxWsEvent } from '@nktkas/hyperliquid'
import type { ActiveSpotAssetCtxWsEvent as _ActiveSpotAssetCtxWsEvent } from '@nktkas/hyperliquid'

/**
 * SDK literal union for `historicalOrders` per-record `status`. The SDK
 * package does not re-export `OrderProcessingStatusSchema` by name, so we
 * derive it structurally from `HistoricalOrdersResponse` — the source of
 * truth is still the SDK type. Used by the order-history reader to assert
 * domain-vs-SDK literal equivalence (`./services/order-history-reader.ts`).
 */
export type OrderProcessingStatusSchema = _HistoricalOrdersResponse[number]['status']

/**
 * Shape of the `ctx` field within `ActiveAssetCtxWsEvent`. The SDK package
 * does not re-export `PerpAssetCtxSchema` by name from its public surface, so
 * we derive it structurally from `ActiveAssetCtxWsEvent['ctx']` — the source
 * of truth is still the SDK type. Used by `market-data-reader.ts` to type the
 * `latestCtx` variable and `emitTicker` parameter without importing the SDK
 * directly (trust-boundary enforcement per ADR-0010).
 */
export type PerpAssetCtxSchema = _ActiveAssetCtxWsEvent['ctx']

/**
 * Shape of the `ctx` field within `ActiveSpotAssetCtxWsEvent`. The SDK package
 * does not re-export `SpotAssetCtxSchema` by name from its public surface, so
 * we derive it structurally from `ActiveSpotAssetCtxWsEvent['ctx']` — the
 * source of truth is still the SDK type. Used by `market-data-reader.ts` to
 * type the spot-ctx projection without importing the SDK directly
 * (trust-boundary enforcement per ADR-0010). Structurally lacks
 * `oraclePx`/`funding`/`openInterest`/`premium` — a spot ctx cannot produce
 * the perp-only `Ticker` fields.
 */
export type SpotAssetCtxSchema = _ActiveSpotAssetCtxWsEvent['ctx']
