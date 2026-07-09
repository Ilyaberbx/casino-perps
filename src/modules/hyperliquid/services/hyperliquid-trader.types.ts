import type { Result } from 'neverthrow'
import type { Logger } from '@/modules/shared/logger'
import type {
  OrderCapacity,
  OrderDraft,
  OrderEstimates,
  OrderIssue,
  PlaceOrderRequest,
  StopLimitOrderRequest,
  StopMarketOrderRequest,
} from '@/modules/shared/domain'
import type { HyperliquidAgentWallet, HyperliquidExchangeGateway } from '../gateway'

/** The two stop variants that build an HL native trigger entry leg (ADR-0034). */
export type StopOrderRequest = StopMarketOrderRequest | StopLimitOrderRequest

/**
 * Asset metadata the trader adapter needs to build a signed order: the HL asset
 * id (`a`), the size decimals (`szDecimals`) that drive price/size rounding, and
 * the market type (`perp` | `spot`) that selects the `formatPrice` rule. Built
 * by the venue composition from a SymbolConverter; injected so the adapter is
 * unit-testable without the SDK. `null` ⇒ symbol unknown to the venue.
 */
export interface HyperliquidAssetInfo {
  readonly assetId: number
  readonly szDecimals: number
  readonly marketType: 'perp' | 'spot'
}

/**
 * Reference prices for deriving a market order's aggressive IOC limit price.
 * `topBid` / `topAsk` are the best bid/ask (top-of-book); `mark` is the fallback
 * used when the relevant side of the book is empty (PRD decision 9). Buys cross
 * up from `topAsk` (× (1 + slippage)); sells cross down from `topBid`.
 */
export interface HyperliquidReferencePrice {
  readonly topBid?: number
  readonly topAsk?: number
  readonly mark?: number
}

/** Builder-fee parameters attached to every signed order (`{ b, f }`). */
export interface HyperliquidBuilderParams {
  readonly address: `0x${string}`
  readonly feeTenthsOfBps: number
}

/**
 * Resolved reference to a resting order needed to cancel / modify it. Resolved
 * from a domain `OrderIdentifier` (the oid string the open-orders snapshot
 * reader emits) via the live open-orders snapshot, which carries the full order
 * state. Cancel needs only `(assetId, oid)`; modify needs the rest because HL's
 * `modify` replaces the whole order — unchanged legs fall back to these. `null`
 * ⇒ the order is no longer resting (already filled / cancelled / unknown).
 */
export interface HyperliquidOrderRef {
  readonly assetId: number
  readonly oid: number
  readonly symbol: string
  readonly side: 'buy' | 'sell'
  readonly price: number
  readonly size: number
  readonly reduceOnly: boolean
}

/**
 * Dependencies for {@link createHyperliquidTrader}. All non-gateway deps are
 * injectable so the adapter is exercised with a fake gateway + fixed resolvers
 * (no network, no signing) in tests.
 */
export interface HyperliquidTraderDeps {
  readonly exchangeGateway: HyperliquidExchangeGateway
  /** Agent wallet for signing; `null` when no approved agent is available. */
  readonly getAgentWallet: () => HyperliquidAgentWallet | null
  /** Resolve HL asset metadata for a domain symbol; `null` when unknown. */
  readonly resolveAsset: (symbol: string) => HyperliquidAssetInfo | null
  /** Resolve a resting order's `(assetId, oid, symbol)` from its identifier for
   *  cancel / modify; `null` when the order is no longer resting. */
  readonly resolveOrderRef: (identifier: string) => HyperliquidOrderRef | null
  /** Current top-of-book / mark reference for a symbol; `null` when unavailable. */
  readonly getReferencePrice: (symbol: string) => HyperliquidReferencePrice | null
  readonly logger: Logger
  /** HL builder fee in tenths of bps + address (`{ b, f }`). */
  readonly builder: HyperliquidBuilderParams
  /** Default slippage tolerance (fraction) for market orders. Defaults to 0.05. */
  readonly defaultSlippageTolerance?: number
}

/**
 * Dependencies for the venue-owned order validation + preview service
 * ({@link createHyperliquidOrderValidation}, ADR-0035). All inputs are pulled
 * through these injected closures so the service stays a pure synchronous
 * parser/pricer, unit-testable without the live readers. The market is resolved
 * from `draft.symbol` (ADR-0057) — the draft is self-describing, so the venue
 * never reads an ambient active-ticker subscription for validation.
 */
/**
 * The open position a reduce-only order is checked against (ADR-0035 D-8, S6).
 * Sourced from the venue's `perpsPositionsSnapshot` capability; `side` is the
 * direction the position is currently in and `size` its absolute coin size.
 */
export interface HyperliquidValidationPosition {
  readonly side: 'buy' | 'sell'
  readonly size: number
}

export interface HyperliquidOrderValidationDeps {
  /** Live mark for a symbol (the reader's live-ticker cache, fallback mark);
   *  `0` when unknown. Shared by the min-notional check and `previewOrder`. */
  readonly markPriceFor: (symbol: string) => number
  /** Per-asset metadata (`szDecimals` + `marketType`) driving the price-tick
   *  (S3) and size lot-step (S4) precision rules; `null` when the symbol is
   *  unknown to the venue (precision rules are then skipped, never falsely
   *  rejected). */
  readonly resolveAsset: (symbol: string) => HyperliquidAssetInfo | null
  /** Current open position for a symbol, driving the reduce-only-reduces rule
   *  (S6); `null` when the account holds no open position for it. */
  readonly currentPositionFor: (symbol: string) => HyperliquidValidationPosition | null
  /** Perp-tradeable collateral (USD) the account can open against — the
   *  corrected `'perps'` available figure (S7 / bug #1). */
  readonly availableMarginFor: (symbol: string) => number
  /** Spot side-relevant balance for `previewOrder` capacity on spot markets:
   *  USDC `available` on a buy, base-token holdings on a sell. */
  readonly spotAvailableFor: (symbol: string, side: 'buy' | 'sell') => number
  /** Whether the symbol is a spot market (no leverage, balance-based sizing). */
  readonly isSpotMarket: (symbol: string) => boolean
  /** Latest perps taker rate (fraction) for the fee estimate; `0` when unknown. */
  readonly takerRate: () => number
  /** Whether a partner builder fee rides every order (annotates the fee row). */
  readonly hasBuilderFee: boolean
}

/** The venue-owned order validation + preview surface (ADR-0035 D-1). */
export interface HyperliquidOrderValidation {
  validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]>
  previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity }
}

/** The discriminated `tif` literal accepted by the HL `limit` order leg. */
export type HyperliquidTif = 'Gtc' | 'Ioc' | 'Alo' | 'FrontendMarket'

/** HL order grouping strategy. */
export type HyperliquidGrouping = 'na' | 'normalTpsl' | 'positionTpsl'
