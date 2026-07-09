import { ResultAsync, okAsync, errAsync } from 'neverthrow'
import {
  HttpTransport,
  InfoClient,
  SubscriptionClient,
  WebSocketTransport,
  type IRequestTransport,
  type ISubscriptionTransport,
} from '@nktkas/hyperliquid'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type {
  HyperliquidCandleInterval,
  HyperliquidGateway,
  HyperliquidSubscription,
  HyperliquidTimeWindow,
  L2BookAggregation,
  MultiplexEntry,
} from './hyperliquid-gateway.types'
import { HyperliquidGatewayError } from './hyperliquid-gateway.types'
import { HYPERLIQUID_HTTP_TIMEOUT_MS } from '../hyperliquid.constants'
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
import { mapSdkError } from './sdk-error-mapping'

export interface NktkasHyperliquidGatewayOptions {
  /** Hyperliquid network. Maps to `isTestnet` on both SDK transports. */
  readonly isTestnet: boolean
  /** Required structured logger. Bound to `module: 'hyperliquid-gateway'`. */
  readonly logger: Logger
  /** Optional HTTP API URL override (defaults derived from `isTestnet`). */
  readonly apiHttpUrl?: string
  /** Optional WS URL override (defaults derived from `isTestnet`). */
  readonly apiWsUrl?: string
  /** Override HTTP transport — used by tests with a fake `IRequestTransport`. */
  readonly httpTransport?: IRequestTransport
  /** Override WS subscription transport — used by tests with a fake. */
  readonly subscriptionTransport?: ISubscriptionTransport
  /**
   * Called on every inbound WS event across all channels (the shared-transport
   * single chokepoint). The connection-liveness coordinator stamps this as
   * "last activity" to drive its staleness probe — if no event has arrived for
   * longer than the stale threshold when the tab resumes, it forces a resync.
   * See ADR-0041.
   */
  readonly notifyActivity?: () => void
}

export function createNktkasHyperliquidGateway(
  options: NktkasHyperliquidGatewayOptions,
): HyperliquidGateway {
  const httpTransport = options.httpTransport ?? new HttpTransport({
    isTestnet: options.isTestnet,
    timeout: HYPERLIQUID_HTTP_TIMEOUT_MS,
    ...(options.apiHttpUrl !== undefined ? { apiUrl: options.apiHttpUrl } : {}),
  })
  const wsTransport = options.subscriptionTransport ?? new WebSocketTransport({
    isTestnet: options.isTestnet,
    ...(options.apiWsUrl !== undefined ? { url: options.apiWsUrl } : {}),
  })
  const infoClient = new InfoClient({ transport: httpTransport })
  const subscriptionClient = new SubscriptionClient({ transport: wsTransport })
  const log = options.logger.child({ module: 'hyperliquid-gateway' })

  function instrument<T>(method: string, run: () => Promise<T>): ResultAsync<T, HyperliquidGatewayError> {
    log.debug({ method }, 'sdk call')
    const startedAt = Date.now()
    return ResultAsync.fromPromise<T, HyperliquidGatewayError>(run(), (cause) => {
      const mapped = mapSdkError(cause)
      const durationMs = Date.now() - startedAt
      log.warn(
        { method, kind: mapped.kind, errorMessage: mapped.message, durationMs },
        'sdk call failed',
      )
      return mapped
    }).map((value) => {
      const durationMs = Date.now() - startedAt
      log.debug({ method, durationMs }, 'sdk call ok')
      return value
    })
  }

  // Coalesces concurrent subscribes for the same (channel, coin[, interval]).
  // The SDK has one shared WebSocketTransport; without this, React StrictMode
  // (and any other duplicate consumer) issues two identical SDK subscribes
  // against an in-flight WS handshake, which the SDK terminates with
  // "WebSocket connection closed". With multiplexing, the first subscribe per
  // key opens one SDK sub; subsequent subscribes attach a listener to the
  // shared fan-out and share the underlying handle via refcount.
  const multiplexEntries = new Map<string, MultiplexEntry<unknown>>()

  function multiplex<TEvent>(
    key: string,
    listener: (event: TEvent) => void,
    openSdkSub: (
      fanout: (event: TEvent) => void,
    ) => ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>,
  ): ResultAsync<HyperliquidSubscription, HyperliquidGatewayError> {
    let entry = multiplexEntries.get(key) as MultiplexEntry<TEvent> | undefined
    if (entry === undefined) {
      const listeners = new Set<(event: TEvent) => void>()
      const fanout = (event: TEvent): void => {
        // Single chokepoint for every channel's WS events (one shared
        // transport) — stamp liveness here so the coordinator's staleness probe
        // sees a fresh timestamp whenever any stream is alive (ADR-0041).
        options.notifyActivity?.()
        for (const l of listeners) l(event)
      }
      const inflight = openSdkSub(fanout)
      const created: MultiplexEntry<TEvent> = {
        refcount: 0,
        listeners,
        inflight,
        sdkSub: null,
        pendingTeardown: false,
      }
      entry = created
      multiplexEntries.set(key, created as MultiplexEntry<unknown>)

      void inflight.then((result) => {
        // If the key was already cleared (e.g. by a teardown race) ignore.
        if (multiplexEntries.get(key) !== (created as MultiplexEntry<unknown>)) {
          if (result.isOk()) void result.value.unsubscribe().catch(() => {})
          return
        }
        if (result.isErr()) {
          multiplexEntries.delete(key)
          return
        }
        created.sdkSub = result.value
        if (created.pendingTeardown && created.refcount === 0) {
          multiplexEntries.delete(key)
          void result.value.unsubscribe().catch(() => {})
        }
      })
    }

    const e = entry
    e.refcount += 1
    e.pendingTeardown = false
    e.listeners.add(listener)

    // Per-handle bridge so each consumer (e.g. each `withReconnect`) sees an
    // independent `failureSignal` it can listen to. Bridged once from the
    // underlying SDK sub when it resolves.
    const bridge = new AbortController()
    void e.inflight.then((result) => {
      if (result.isErr()) {
        bridge.abort(new Error(result.error.message))
        return
      }
      const sig = result.value.failureSignal
      if (sig.aborted) {
        bridge.abort(sig.reason)
        return
      }
      sig.addEventListener('abort', () => bridge.abort(sig.reason), { once: true })
    })

    let unsubscribed = false
    const handle: HyperliquidSubscription = {
      failureSignal: bridge.signal,
      async unsubscribe(): Promise<void> {
        if (unsubscribed) return
        unsubscribed = true
        e.listeners.delete(listener)
        e.refcount -= 1
        if (e.refcount > 0) return
        if (e.sdkSub !== null) {
          if (multiplexEntries.get(key) === (e as MultiplexEntry<unknown>)) {
            multiplexEntries.delete(key)
          }
          const sub = e.sdkSub
          e.sdkSub = null
          await sub.unsubscribe().catch(() => {})
        } else {
          e.pendingTeardown = true
        }
      },
    }

    return e.inflight.andThen(() => okAsync(handle)).orElse((err) => {
      // Detach our listener so a follow-up subscribe starts clean.
      e.listeners.delete(listener)
      e.refcount = Math.max(0, e.refcount - 1)
      return errAsync(err)
    })
  }

  return {
    fetchWebData2(address: WalletAddress) {
      return instrument<WebData2Response>('webData2', () => infoClient.webData2({ user: address }))
    },

    subscribeWebData2(address: WalletAddress, listener: (data: WebData2Response) => void) {
      // Multiplexed for the same reason as the channel subscriptions above:
      // a duplicate SDK subscribe against an in-flight WS handshake (e.g. a
      // teardown-then-resubscribe race when the wallet address rotates, or
      // any second consumer that beats `WebData2Stream`'s `activeAddress`
      // guard) makes the SDK terminate the handshake with "WebSocket
      // connection closed". With multiplexing, the first subscribe per
      // (address) opens one SDK sub; later subscribes share the underlying
      // handle via refcount.
      return multiplex<WebData2Response>(`webData2|${address}`, listener, (fanout) =>
        instrument<HyperliquidSubscription>('subscribeWebData2', () =>
          subscriptionClient.webData2({ user: address }, fanout).then((sub) => ({
            unsubscribe: () => sub.unsubscribe(),
            failureSignal: sub.failureSignal,
          })),
        ),
      )
    },

    subscribeAllDexsClearinghouseState(
      address: WalletAddress,
      listener: (data: AllDexsClearinghouseStateEvent) => void,
    ) {
      // Multiplexed for the same reason as `subscribeWebData2`: a duplicate SDK
      // subscribe against an in-flight WS handshake (teardown-then-resubscribe
      // race on address rotation, or a second consumer beating the stream's
      // `activeAddress` guard) makes the SDK terminate the handshake. With
      // multiplexing, the first subscribe per (address) opens one SDK sub;
      // later subscribes share the underlying handle via refcount.
      return multiplex<AllDexsClearinghouseStateEvent>(
        `allDexsClearinghouseState|${address}`,
        listener,
        (fanout) =>
          instrument<HyperliquidSubscription>('subscribeAllDexsClearinghouseState', () =>
            subscriptionClient
              .allDexsClearinghouseState({ user: address }, fanout)
              .then((sub) => ({
                unsubscribe: () => sub.unsubscribe(),
                failureSignal: sub.failureSignal,
              })),
          ),
      )
    },

    getPortfolio(address: WalletAddress) {
      return instrument<PortfolioResponse>('portfolio', () => infoClient.portfolio({ user: address }))
    },

    getUserFees(address: WalletAddress) {
      return instrument<UserFeesResponse>('userFees', () => infoClient.userFees({ user: address }))
    },

    getDelegatorSummary(address: WalletAddress) {
      return instrument<DelegatorSummaryResponse>('delegatorSummary', () =>
        infoClient.delegatorSummary({ user: address }),
      )
    },

    getSpotMetaAndAssetCtxs() {
      return instrument<SpotMetaAndAssetCtxsResponse>('spotMetaAndAssetCtxs', () =>
        infoClient.spotMetaAndAssetCtxs(),
      )
    },

    getMetaAndAssetCtxs() {
      return instrument<MetaAndAssetCtxsResponse>('metaAndAssetCtxs', () =>
        infoClient.metaAndAssetCtxs(),
      )
    },

    getPerpMetaAndAssetCtxs(dex: string) {
      return instrument<MetaAndAssetCtxsResponse>('metaAndAssetCtxs', () =>
        infoClient.metaAndAssetCtxs({ dex }),
      )
    },

    getPerpDexs() {
      return instrument<PerpDexsResponse>('perpDexs', () => infoClient.perpDexs())
    },

    getAllPerpMetas() {
      return instrument<AllPerpMetasResponse>('allPerpMetas', () =>
        infoClient.allPerpMetas(),
      )
    },

    getCandleSnapshot(
      coin: string,
      interval: HyperliquidCandleInterval,
      startTime: number,
      endTime?: number,
    ) {
      return instrument<CandleSnapshotResponse>('candleSnapshot', () =>
        infoClient.candleSnapshot({
          coin,
          interval,
          startTime,
          ...(endTime !== undefined ? { endTime } : {}),
        }),
      )
    },

    subscribeCandle(
      coin: string,
      interval: HyperliquidCandleInterval,
      listener: (event: CandleWsEvent) => void,
    ) {
      return multiplex<CandleWsEvent>(`candle|${coin}|${interval}`, listener, (fanout) =>
        instrument<HyperliquidSubscription>('subscribeCandle', () =>
          subscriptionClient.candle({ coin, interval }, fanout).then((sub) => ({
            unsubscribe: () => sub.unsubscribe(),
            failureSignal: sub.failureSignal,
          })),
        ),
      )
    },

    subscribeL2Book(
      coin: string,
      listener: (event: L2BookWsEvent) => void,
      aggregation?: L2BookAggregation,
    ) {
      const nSigFigs = aggregation?.nSigFigs ?? null
      const mantissa = aggregation?.mantissa ?? null
      const multiplexKey = `l2Book|${coin}|${nSigFigs ?? 'native'}|${mantissa ?? 'native'}`
      return multiplex<L2BookWsEvent>(multiplexKey, listener, (fanout) =>
        instrument<HyperliquidSubscription>('subscribeL2Book', () =>
          subscriptionClient
            .l2Book({ coin, nSigFigs, mantissa }, fanout)
            .then((sub) => ({
              unsubscribe: () => sub.unsubscribe(),
              failureSignal: sub.failureSignal,
            })),
        ),
      )
    },

    subscribeTradesStream(coin: string, listener: (event: TradesWsEvent) => void) {
      return multiplex<TradesWsEvent>(`trades|${coin}`, listener, (fanout) =>
        instrument<HyperliquidSubscription>('subscribeTrades', () =>
          subscriptionClient.trades({ coin }, fanout).then((sub) => ({
            unsubscribe: () => sub.unsubscribe(),
            failureSignal: sub.failureSignal,
          })),
        ),
      )
    },

    subscribeActiveAssetCtx(coin: string, listener: (event: ActiveAssetCtxWsEvent) => void) {
      return multiplex<ActiveAssetCtxWsEvent>(`activeAssetCtx|${coin}`, listener, (fanout) =>
        instrument<HyperliquidSubscription>('subscribeActiveAssetCtx', () =>
          subscriptionClient.activeAssetCtx({ coin }, fanout).then((sub) => ({
            unsubscribe: () => sub.unsubscribe(),
            failureSignal: sub.failureSignal,
          })),
        ),
      )
    },

    subscribeActiveSpotAssetCtx(coin: string, listener: (event: ActiveSpotAssetCtxWsEvent) => void) {
      // The SDK helper sends `{ type: "activeAssetCtx", coin: "@N" }` and HL
      // routes spot coins to the `activeSpotAssetCtx` channel (verified live
      // 2026-06-11). `coin` MUST be the HL wire key (`@N`, or the literal
      // `PURR/USDC` for the canonical pair) — a display symbol like
      // `BTC/USDC` yields an `Invalid subscription` error frame. The
      // reader's `resolveHlCoin`/`guardedHlCoin` seam guarantees this.
      // Multiplex key is spot-prefixed so a same-coin perp/spot pair never
      // shares a fanout with `activeAssetCtx|${coin}`.
      return multiplex<ActiveSpotAssetCtxWsEvent>(`activeSpotAssetCtx|${coin}`, listener, (fanout) =>
        instrument<HyperliquidSubscription>('subscribeActiveSpotAssetCtx', () =>
          subscriptionClient.activeSpotAssetCtx({ coin }, fanout).then((sub) => ({
            unsubscribe: () => sub.unsubscribe(),
            failureSignal: sub.failureSignal,
          })),
        ),
      )
    },

    getBorrowLendUserState(address: WalletAddress) {
      return instrument<BorrowLendUserStateResponse>('borrowLendUserState', () =>
        infoClient.borrowLendUserState({ user: address }),
      )
    },

    getUserFillsByTime(address: WalletAddress, window: HyperliquidTimeWindow) {
      // `reversed: true` makes HL return fills newest-first (verified live; the
      // sibling ledger endpoints ignore this flag). The trade-history reader
      // pages the next-older window by `endTime`, so newest-first is required to
      // show recent trades on top for heavy (>cap) accounts. See ADR-0034.
      return instrument<UserFillsByTimeResponse>('userFillsByTime', () =>
        infoClient.userFillsByTime({ user: address, ...window, reversed: true }),
      )
    },

    getUserFunding(address: WalletAddress, window: HyperliquidTimeWindow) {
      return instrument<UserFundingResponse>('userFunding', () =>
        infoClient.userFunding({ user: address, ...window }),
      )
    },

    getUserBorrowLendInterest(address: WalletAddress, window: HyperliquidTimeWindow) {
      return instrument<UserBorrowLendInterestResponse>('userBorrowLendInterest', () =>
        infoClient.userBorrowLendInterest({ user: address, ...window }),
      )
    },

    getUserNonFundingLedgerUpdates(
      address: WalletAddress,
      window: HyperliquidTimeWindow,
    ) {
      return instrument<UserNonFundingLedgerUpdatesResponse>('userNonFundingLedgerUpdates', () =>
        infoClient.userNonFundingLedgerUpdates({ user: address, ...window }),
      )
    },

    getTwapHistory(address: WalletAddress) {
      return instrument<TwapHistoryResponse>('twapHistory', () =>
        infoClient.twapHistory({ user: address }),
      )
    },

    getUserTwapSliceFills(address: WalletAddress, window: HyperliquidTimeWindow) {
      return instrument<UserTwapSliceFillsByTimeResponse>('userTwapSliceFillsByTime', () =>
        infoClient.userTwapSliceFillsByTime({ user: address, ...window }),
      )
    },

    getHistoricalOrders(address: WalletAddress) {
      return instrument<HistoricalOrdersResponse>('historicalOrders', () =>
        infoClient.historicalOrders({ user: address }),
      )
    },

    queryUserAbstraction(address: WalletAddress) {
      return instrument<UserAbstractionResponse>('userAbstraction', () =>
        infoClient.userAbstraction({ user: address }),
      )
    },
  }
}
