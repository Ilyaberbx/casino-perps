import { err, errAsync, ok, ResultAsync, type Result } from 'neverthrow'
import type {
  Candle,
  CandleError as CandleErrorType,
  CandlesReader,
  CandleUpdate,
  Interval,
  LoadOlderResult,
  ResyncSignal,
  Unsubscribe,
} from '@/modules/shared/domain'
import { CandleError } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type {
  HyperliquidCandleInterval,
  HyperliquidGateway,
} from '../gateway/hyperliquid-gateway.types'
import { HyperliquidGatewayError } from '../gateway/hyperliquid-gateway.types'
import type { CandleSnapshotResponse, CandleWsEvent } from '../gateway/sdk-types'
import { toDomainPerpSymbol, toHlCoin } from '../hyperliquid.utils'
import { withReconnect } from '@/modules/shared/services/with-reconnect'

const INTERVAL_MS: Readonly<Record<Interval, number>> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
  // Approximate (calendar months vary). Only drives history fetch range and
  // loadOlder pagination math, never candle bucketing — HL returns the real
  // monthly `openTime`s — so a 30-day stand-in is safe.
  '1M': 2_592_000_000,
}

const HISTORY_BACK_MS: Readonly<Record<Interval, number>> = {
  '1m': INTERVAL_MS['1m'] * 500,
  '5m': INTERVAL_MS['5m'] * 500,
  '15m': INTERVAL_MS['15m'] * 500,
  '1h': INTERVAL_MS['1h'] * 500,
  '4h': INTERVAL_MS['4h'] * 500,
  '1d': INTERVAL_MS['1d'] * 500,
  '1w': INTERVAL_MS['1w'] * 500,
  '1M': INTERVAL_MS['1M'] * 500,
}

// Retry on transient network/rate-limit before giving up. Hyperliquid's HTTP
// `info` backend occasionally 500s in short bursts (observed: 2 consecutive
// 500s, then 3rd attempt succeeds); 3 attempts covers the typical burst.
const HTTP_RETRY_ATTEMPTS = 3
const HTTP_RETRY_BASE_DELAY_MS = 400
const HTTP_RETRY_RATE_LIMIT_DELAY_MS = 1_500

export interface CreateHyperliquidCandlesReaderOptions {
  readonly gateway: HyperliquidGateway
  readonly logger: Logger
  /** Override `Date.now` in tests. */
  readonly now?: () => number
  /** Override timer in tests. */
  readonly setTimeout?: (handler: () => void, ms: number) => unknown
  /** Liveness source forwarded to withReconnect for resume-driven resync (ADR-0041). */
  readonly resyncSignal?: ResyncSignal
}

function key(symbol: string, interval: Interval): string {
  return `${symbol}|${interval}`
}

function projectSnapshot(c: CandleSnapshotResponse[number], interval: Interval): Candle {
  return {
    symbol: toDomainPerpSymbol(c.s),
    interval,
    openTime: c.t,
    open: Number(c.o),
    high: Number(c.h),
    low: Number(c.l),
    close: Number(c.c),
    volume: Number(c.v),
  }
}

function projectEvent(e: CandleWsEvent, interval: Interval): Candle {
  return {
    symbol: toDomainPerpSymbol(e.s),
    interval,
    openTime: e.t,
    open: Number(e.o),
    high: Number(e.h),
    low: Number(e.l),
    close: Number(e.c),
    volume: Number(e.v),
  }
}

function isRetryableHttp(e: HyperliquidGatewayError): boolean {
  return e.kind === 'network' || e.kind === 'rate-limited'
}

// Merge candle groups into one buffer that is strictly ascending by openTime
// with no duplicate bars. On an openTime collision the later group wins, so a
// re-fetched bar carries the freshest OHLCV. getHistory feeds this cache
// straight into lightweight-charts' setData, which hard-asserts strict
// ascending order — an unguarded prepend doubled a re-fetched older page and
// tripped that assertion (STAB-02). Pass freshest groups last.
function mergeAscByOpenTime(...groups: Candle[][]): Candle[] {
  const byOpenTime = new Map<number, Candle>()
  for (const group of groups) {
    for (const candle of group) byOpenTime.set(candle.openTime, candle)
  }
  return [...byOpenTime.values()].sort((a, b) => a.openTime - b.openTime)
}

export function createHyperliquidCandlesReader(
  options: CreateHyperliquidCandlesReaderOptions,
): CandlesReader {
  const log = options.logger.child({ module: 'hyperliquid-candles-reader' })
  const cache = new Map<string, Candle[]>()
  const now = options.now ?? Date.now
  const schedule = options.setTimeout ?? ((h, ms) => setTimeout(h, ms))

  async function fetchWindowWithRetry(
    symbol: string,
    interval: Interval,
    startTime: number,
    endTime: number | undefined,
    isStopped: () => boolean,
  ): Promise<Result<CandleSnapshotResponse, HyperliquidGatewayError> | null> {
    const hlInterval = interval as HyperliquidCandleInterval
    const hlCoin = toHlCoin(symbol)
    let lastErr: HyperliquidGatewayError | null = null
    for (let attempt = 1; attempt <= HTTP_RETRY_ATTEMPTS; attempt += 1) {
      if (isStopped()) return null
      const res = await options.gateway.getCandleSnapshot(hlCoin, hlInterval, startTime, endTime)
      if (res.isOk()) return res
      lastErr = res.error
      const isLastAttempt = attempt === HTTP_RETRY_ATTEMPTS
      if (!isRetryableHttp(res.error) || isLastAttempt) break
      const delay =
        res.error.kind === 'rate-limited'
          ? HTTP_RETRY_RATE_LIMIT_DELAY_MS
          : HTTP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
      log.debug(
        { symbol, interval, attempt, kind: res.error.kind, delayMs: delay },
        'history fetch retry',
      )
      await new Promise<void>((resolve) => schedule(resolve, delay))
    }
    return lastErr === null ? null : err(lastErr)
  }

  return {
    getHistory(symbol: string, interval: Interval): Result<Candle[], CandleErrorType> {
      return ok(cache.get(key(symbol, interval)) ?? [])
    },
    loadOlder(
      symbol: string,
      interval: Interval,
      beforeOpenTime: number,
      count: number,
    ): ResultAsync<LoadOlderResult, CandleErrorType> {
      const intervalMs = INTERVAL_MS[interval]
      const isIntervalUnknown = intervalMs === undefined
      if (isIntervalUnknown) {
        return errAsync(new CandleError('invalid-interval', `unknown interval ${interval}`))
      }
      // HL caps each `info.candleSnapshot` response at 500 bars; clamp the
      // request so reachedStart can compare apples to apples.
      const requested = Math.min(Math.max(1, count), 500)
      const endTime = beforeOpenTime - 1
      const startTime = beforeOpenTime - intervalMs * requested
      const promise = fetchWindowWithRetry(symbol, interval, startTime, endTime, () => false).then(
        (res): Result<LoadOlderResult, CandleErrorType> => {
          if (res === null || res.isErr()) {
            const kind = res === null ? 'unknown' : res.error.kind
            const message = res === null ? 'no result' : res.error.message
            log.warn({ symbol, interval, kind, errorMessage: message }, 'loadOlder failed')
            return err(new CandleError('load-older-failed', `loadOlder failed: ${kind}`))
          }
          const projected = res.value
            .map((c) => projectSnapshot(c, interval))
            .filter((c) => c.openTime < beforeOpenTime)
            .sort((a, b) => a.openTime - b.openTime)
          const reachedStart = projected.length === 0 || res.value.length < requested
          const k = key(symbol, interval)
          const prior = cache.get(k) ?? []
          // Strict-ascending + dedup: prior may already overlap this page when
          // a cancelled pan-back left the cache ahead of the chart's buffer and
          // the next pan-back re-fetched the same window (STAB-02).
          const merged = mergeAscByOpenTime(prior, projected)
          cache.set(k, merged)
          return ok({ candles: projected, reachedStart })
        },
      )
      return ResultAsync.fromSafePromise(promise).andThen((r) => r)
    },
    subscribe(
      symbol: string,
      interval: Interval,
      onUpdate: (update: CandleUpdate) => void,
    ): Unsubscribe {
      const hlCoin = toHlCoin(symbol)
      // Empty-symbol safety net: an unresolved market would forward
      // `coin: ""` to HL, which rejects with "Invalid subscription" and
      // closes the shared WebSocketTransport — taking out every other live
      // stream. Refuse and return a no-op. Component-side skip is the
      // primary defence; this is the gateway-side belt-and-braces.
      // See plan `enchanted-bubbling-hopcroft.md` (Bug A).
      if (symbol === '' || hlCoin === '') {
        log.warn({ symbol, channel: 'candle' }, 'subscribe skipped: unresolved symbol')
        return () => {}
      }
      let stopped = false
      const hlInterval = interval as HyperliquidCandleInterval

      // 1) HTTP snapshot (with retry) of the full visible window, emitted as one
      // bulk `snapshot` the consumer applies via setData. Runs at initial
      // subscribe AND on every reconnect (onResync below): a reconnect replaces
      // the series in one paint rather than replaying the buffered backlog as a
      // stream of per-candle updates — the "10× replay" after a tab resume, and
      // the source of permanent gaps when a drop's missing bars were never
      // refetched (ADR-0041). The window start is recomputed from `now()` each
      // call, so a resync backfills everything up to the current tick.
      function fetchAndEmitSnapshot(): void {
        const startTime = now() - HISTORY_BACK_MS[interval]
        void fetchWindowWithRetry(symbol, interval, startTime, undefined, () => stopped).then(
          (res) => {
            if (stopped || res === null) return
            if (res.isErr()) {
              log.warn(
                { kind: res.error.kind, errorMessage: res.error.message, symbol, interval },
                'history fetch failed',
              )
              return
            }
            const projected = res.value.map((c) => projectSnapshot(c, interval))
            cache.set(key(symbol, interval), projected)
            onUpdate({ kind: 'snapshot', candles: projected })
          },
        )
      }

      fetchAndEmitSnapshot()

      // 2) Live WS — each event is either an update to the last bar or a new bar.
      // Self-healing via withReconnect: on subscribe-time failure or mid-stream
      // failureSignal abort, retry with exponential backoff.
      const handle = withReconnect({
        subscribe: () =>
          options.gateway.subscribeCandle(hlCoin, hlInterval, (event: CandleWsEvent) => {
            const candle = projectEvent(event, interval)
            const k = key(symbol, interval)
            const prior = cache.get(k) ?? []
            const last = prior[prior.length - 1]
            const hasLast = last !== undefined
            const isStale = hasLast && candle.openTime < last.openTime
            // Drop out-of-order WS / backfill-replay candles so the cached
            // buffer and the emitted update stream stay strictly ascending by
            // openTime (STAB-01 root cause: backfill .then() racing the live
            // stream). openTime ordering is the source of truth, not arrival.
            if (isStale) return
            const isSameBar = hasLast && candle.openTime === last.openTime
            const nextHistory = isSameBar
              ? [...prior.slice(0, -1), candle]
              : [...prior, candle]
            cache.set(k, nextHistory)
            onUpdate(isSameBar ? { kind: 'update', candle } : { kind: 'new', candle })
          }),
        logger: log,
        logContext: { symbol, interval },
        event: 'candle subscribe',
        // Reconnect → refetch the full window and bulk-replace, never replay the
        // backlog (ADR-0041). The strict-ascending openTime guard above drops any
        // stale buffered deltas that land after the fresh snapshot.
        onResync: fetchAndEmitSnapshot,
        // Injectable backoff timer so reconnect/resync is testable with no real
        // timers (websocket-streaming.md §7); defaults to the global setTimeout.
        setTimeout: options.setTimeout,
        // Tab-resume / network-online forces a reconnect → fetchAndEmitSnapshot.
        resyncSignal: options.resyncSignal,
      })

      return () => {
        stopped = true
        handle.unsubscribe()
      }
    },
  }
}
