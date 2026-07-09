import type { ResultAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import type {
  ActiveAssetCtxWsEvent,
  ActiveSpotAssetCtxWsEvent,
  AllDexsClearinghouseStateEvent,
  AllPerpMetasResponse,
  BorrowLendUserStateResponse,
  DelegatorSummaryResponse,
  CandleSnapshotResponse,
  CandleWsEvent,
  L2BookWsEvent,
  TradesWsEvent,
  HistoricalOrdersResponse,
  MetaAndAssetCtxsResponse,
  PerpDexsResponse,
  PortfolioResponse,
  SpotMetaAndAssetCtxsResponse,
  TwapHistoryResponse,
  UserTwapSliceFillsByTimeResponse,
  UserBorrowLendInterestResponse,
  UserFeesResponse,
  UserFillsByTimeResponse,
  UserFundingResponse,
  UserNonFundingLedgerUpdatesResponse,
  UserAbstractionResponse,
  WebData2Response,
} from './sdk-types'

/**
 * Half-open time window `[startTime, endTime)` (ms since epoch) used by the
 * paged history endpoints. `endTime` is optional — the SDK treats omission as
 * "open-ended; fetch up to current time".
 */
export interface HyperliquidTimeWindow {
  readonly startTime: number
  readonly endTime?: number
}

/** Subset of HL candle intervals exposed by the domain. */
export type HyperliquidCandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'

/**
 * Server-side aggregation parameters for HL's `l2Book` subscription. HL's
 * `nSigFigs` accepts {2,3,4,5} (or null = native precision); `mantissa`
 * accepts {2,5} (or null) and is only honored when `nSigFigs === 5`.
 */
export interface L2BookAggregation {
  readonly nSigFigs?: 2 | 3 | 4 | 5
  readonly mantissa?: 2 | 5
}

export type HyperliquidGatewayErrorKind =
  | 'network'
  | 'invalid-response'
  | 'rate-limited'
  | 'unknown-address'
  | 'wallet-rejected'
  | 'chain-mismatch'
  | 'builder-not-funded'
  | 'deposit-required'
  | 'approval-cap-reached'
  | 'agent-cap-reached'
  | 'name-collision'
  // HL anti-replay: the agent address was already approved once (ADR-0077).
  // Only surfaces from `approveAgent`; recoverable by minting a fresh keypair.
  | 'agent-address-reused'

export class HyperliquidGatewayError extends Error {
  readonly kind: HyperliquidGatewayErrorKind
  readonly cause?: unknown
  constructor(kind: HyperliquidGatewayErrorKind, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'HyperliquidGatewayError'
  }
}

/**
 * Gateway is the only seam in hyperliquid/ that knows about @nktkas/hyperliquid.
 * Methods return SDK-typed payloads inside our typed Result. Readers project
 * SDK types into domain shapes themselves — see ADR-0010.
 */
export interface HyperliquidGateway {
  fetchWebData2(
    address: WalletAddress,
  ): ResultAsync<WebData2Response, HyperliquidGatewayError>

  /**
   * Subscribe to live `webData2` updates. Returns the SDK's subscription handle
   * directly; consumers observe `failureSignal` to react to terminal failure.
   */
  subscribeWebData2(
    address: WalletAddress,
    listener: (data: WebData2Response) => void,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  /**
   * Subscribe to live `allDexsClearinghouseState` updates — clearinghouse state
   * for the main perp dex (`dex === ''`) PLUS every HIP-3 dex, in one event.
   * The sole source for all perp positions (main + HIP-3). Returns the SDK's
   * subscription handle directly; consumers observe `failureSignal` to react to
   * terminal failure.
   */
  subscribeAllDexsClearinghouseState(
    address: WalletAddress,
    listener: (data: AllDexsClearinghouseStateEvent) => void,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  getPortfolio(
    address: WalletAddress,
  ): ResultAsync<PortfolioResponse, HyperliquidGatewayError>

  getUserFees(
    address: WalletAddress,
  ): ResultAsync<UserFeesResponse, HyperliquidGatewayError>

  getDelegatorSummary(
    address: WalletAddress,
  ): ResultAsync<DelegatorSummaryResponse, HyperliquidGatewayError>

  getSpotMetaAndAssetCtxs(): ResultAsync<
    SpotMetaAndAssetCtxsResponse,
    HyperliquidGatewayError
  >

  /** Perps universe + per-asset live context (mark, prevDay, day notional volume). */
  getMetaAndAssetCtxs(): ResultAsync<MetaAndAssetCtxsResponse, HyperliquidGatewayError>

  /**
   * Per-HIP-3-dex perp universe + per-asset live context. Same response shape
   * as the main `getMetaAndAssetCtxs()`, but for a builder-deployed dex. The
   * `dex` string is the dex name as returned by `getPerpDexs()` (e.g. 'xyz').
   */
  getPerpMetaAndAssetCtxs(
    dex: string,
  ): ResultAsync<MetaAndAssetCtxsResponse, HyperliquidGatewayError>

  /** Enumerate all registered HIP-3 dexes. null entry = main HL DEX (skip for HIP-3). */
  getPerpDexs(): ResultAsync<PerpDexsResponse, HyperliquidGatewayError>

  /** All-dex perp meta; index i corresponds to perpDexs()[i]. */
  getAllPerpMetas(): ResultAsync<AllPerpMetasResponse, HyperliquidGatewayError>

  /** Historical candles for a coin/interval. `startTime` is required (ms epoch). */
  getCandleSnapshot(
    coin: string,
    interval: HyperliquidCandleInterval,
    startTime: number,
    endTime?: number,
  ): ResultAsync<CandleSnapshotResponse, HyperliquidGatewayError>

  /** Live candle stream for a coin/interval. */
  subscribeCandle(
    coin: string,
    interval: HyperliquidCandleInterval,
    listener: (event: CandleWsEvent) => void,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  /**
   * Live L2 order book stream for a coin (full top-20 snapshot per tick).
   * When `aggregation.nSigFigs` is set, HL aggregates server-side and returns
   * 20 levels at that precision — required when the user's display tick is
   * coarser than the venue's native tick, otherwise the tight ~20-level
   * native book collapses into 2–3 buckets client-side.
   */
  subscribeL2Book(
    coin: string,
    listener: (event: L2BookWsEvent) => void,
    aggregation?: L2BookAggregation,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  /** Live trades stream for a coin (real-time only, no historical backfill). */
  subscribeTradesStream(
    coin: string,
    listener: (event: TradesWsEvent) => void,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  /** Live per-coin perpetual asset context stream (mark, oracle, funding, OI). */
  subscribeActiveAssetCtx(
    coin: string,
    listener: (event: ActiveAssetCtxWsEvent) => void,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  /**
   * Live per-coin spot asset context stream (mark, mid, prevDay, day volume).
   * Spot ctx has no oracle/funding/OI — see `SpotAssetCtxSchema`.
   */
  subscribeActiveSpotAssetCtx(
    coin: string,
    listener: (event: ActiveSpotAssetCtxWsEvent) => void,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>

  getBorrowLendUserState(
    address: WalletAddress,
  ): ResultAsync<BorrowLendUserStateResponse, HyperliquidGatewayError>

  /**
   * Paged: array of fills in `[startTime, endTime)`. Caller pages by advancing
   * `startTime` to the last fill's timestamp + 1 ms.
   */
  getUserFillsByTime(
    address: WalletAddress,
    window: HyperliquidTimeWindow,
  ): ResultAsync<UserFillsByTimeResponse, HyperliquidGatewayError>

  /** Paged: funding payments in `[startTime, endTime)`. */
  getUserFunding(
    address: WalletAddress,
    window: HyperliquidTimeWindow,
  ): ResultAsync<UserFundingResponse, HyperliquidGatewayError>

  /** Paged: borrow/lend interest accruals in `[startTime, endTime)`. */
  getUserBorrowLendInterest(
    address: WalletAddress,
    window: HyperliquidTimeWindow,
  ): ResultAsync<UserBorrowLendInterestResponse, HyperliquidGatewayError>

  /** Paged: non-funding ledger updates (deposits, withdrawals, transfers, …). */
  getUserNonFundingLedgerUpdates(
    address: WalletAddress,
    window: HyperliquidTimeWindow,
  ): ResultAsync<UserNonFundingLedgerUpdatesResponse, HyperliquidGatewayError>

  /** One-shot: full TWAP history for the user (no time window param). */
  getTwapHistory(
    address: WalletAddress,
  ): ResultAsync<TwapHistoryResponse, HyperliquidGatewayError>

  /**
   * Paged: per-slice TWAP fills in `[startTime, endTime)` via the
   * `userTwapSliceFillsByTime` info endpoint (ADR-0053). Each row carries a
   * `fill` (same shape as `userFillsByTime`) plus the owning `twapId`. Caller
   * pages the next-older window by an `endTime` cursor, like the trade-history
   * reader.
   */
  getUserTwapSliceFills(
    address: WalletAddress,
    window: HyperliquidTimeWindow,
  ): ResultAsync<UserTwapSliceFillsByTimeResponse, HyperliquidGatewayError>

  /** One-shot: full historical orders list for the user (no time window param). */
  getHistoricalOrders(
    address: WalletAddress,
  ): ResultAsync<HistoricalOrdersResponse, HyperliquidGatewayError>

  /**
   * One-shot: the user's account abstraction mode (`disabled | default |
   * unifiedAccount | portfolioMargin | dexAbstraction`). Address-only, no
   * signature. Drives the venue-agnostic `accountMode` capability (segregated
   * vs unified) — see ADR-0033. `default`/`disabled` are classic segregated
   * Spot/Perp accounts; `unifiedAccount`/`portfolioMargin` share one balance.
   */
  queryUserAbstraction(
    address: WalletAddress,
  ): ResultAsync<UserAbstractionResponse, HyperliquidGatewayError>
}

/**
 * Mirror of the SDK's `ISubscription` shape so consumers don't need to import
 * the SDK directly. The fields are pass-through identity; we just retype them
 * through this module's seam.
 */
export interface HyperliquidSubscription {
  unsubscribe(): Promise<void>
  failureSignal: AbortSignal
}

/**
 * Fan-out bookkeeping for the gateway's subscribe multiplex: one entry per
 * (channel, coin[, interval]) key. Coalesces concurrent subscribes onto a
 * single shared SDK subscription via refcount (see `nktkas-hyperliquid-gateway`).
 */
export interface MultiplexEntry<TEvent> {
  refcount: number
  listeners: Set<(event: TEvent) => void>
  inflight: ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>
  sdkSub: HyperliquidSubscription | null
  pendingTeardown: boolean
}
