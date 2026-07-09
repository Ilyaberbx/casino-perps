import type { ResultAsync } from 'neverthrow'
import type {
  ConnectionStatus,
  ConnectionStatusSource,
  ResyncSignal,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { scrubAddresses } from '@/modules/shared/logger'

/**
 * Structural shape every reconnectable subscription must satisfy. The helper
 * never touches anything beyond `failureSignal` (mid-stream abort) and
 * `unsubscribe()` (best-effort teardown). The two Hyperliquid SDK shapes
 * (`HyperliquidSubscription`) match this contract by structure — no nominal
 * coupling between this module and any venue.
 */
export interface ReconnectableSubscription {
  readonly failureSignal: AbortSignal
  unsubscribe(): Promise<void>
}

/**
 * Structural shape every reconnectable subscribe error must satisfy. The
 * helper only reads `kind` (logged as a discriminator) and `message` (scrubbed
 * for addresses before logging). Venue gateways throw nominal error classes
 * that match by structure.
 */
export interface ReconnectableGatewayError {
  readonly kind: string
  readonly message: string
}

export interface WithReconnectOptions<
  TSub extends ReconnectableSubscription,
  TErr extends ReconnectableGatewayError,
> {
  readonly subscribe: () => ResultAsync<TSub, TErr>
  /** Already child-bound; helper adds `attempt` and `event` fields per record. */
  readonly logger: Logger
  /** Extra fields merged into every log record (e.g. `{ symbol, interval }`). */
  readonly logContext?: Record<string, unknown>
  /** Short event label: `'l2Book subscribe'`, `'trades subscribe'`, `'candle subscribe'`. */
  readonly event: string
  /**
   * Fired once per *re*connect-success — never on the first connect. The owning
   * service refetches an authoritative snapshot and replaces local state, rather
   * than replaying the buffered backlog as a stream of deltas. See ADR-0041.
   */
  readonly onResync?: () => void
  /**
   * Liveness source. When it fires, the helper tears down the live subscription
   * and reconnects, routing through the same `reconnecting → connected →
   * onResync` path used for a mid-stream `failureSignal` abort. Recovers a
   * silently-dead socket (suspended tab / dropped mobile connection) that never
   * fires `failureSignal`. See ADR-0041.
   */
  readonly resyncSignal?: ResyncSignal
  readonly backoff?: BackoffPolicy
  readonly setTimeout?: (handler: () => void, ms: number) => unknown
  readonly clearTimeout?: (handle: unknown) => void
  readonly random?: () => number
}

export interface BackoffPolicy {
  readonly baseMs: number
  readonly maxMs: number
  readonly factor: number
  /** When true, jitter the delay uniformly in `[0, delay]`. */
  readonly jitter: boolean
}

const DEFAULT_BACKOFF: BackoffPolicy = {
  baseMs: 250,
  maxMs: 30_000,
  factor: 2,
  jitter: true,
}

export interface WithReconnectHandle {
  readonly connectionStatus: ConnectionStatusSource
  unsubscribe: Unsubscribe
}

export function withReconnect<
  TSub extends ReconnectableSubscription,
  TErr extends ReconnectableGatewayError,
>(opts: WithReconnectOptions<TSub, TErr>): WithReconnectHandle {
  const policy = opts.backoff ?? DEFAULT_BACKOFF
  const schedule = opts.setTimeout ?? ((h, ms) => setTimeout(h, ms))
  const cancel = opts.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const random = opts.random ?? Math.random
  const ctx = opts.logContext ?? {}

  let status: ConnectionStatus = 'disconnected'
  const statusListeners = new Set<(s: ConnectionStatus) => void>()
  let stopped = false
  let attempt = 0
  let hasEverConnected = false
  let activeSub: TSub | null = null
  let pendingTimer: unknown = null
  let inflightSettled = false

  function setStatus(next: ConnectionStatus): void {
    if (status === next) return
    const previous = status
    status = next
    opts.logger.info({ ...ctx, event: opts.event, from: previous, to: next }, 'connection status')
    for (const listener of statusListeners) listener(status)
  }

  function delayFor(n: number): number {
    const exp = Math.min(policy.baseMs * policy.factor ** n, policy.maxMs)
    return policy.jitter ? random() * exp : exp
  }

  function tryConnect(): void {
    if (stopped) return
    attempt += 1
    setStatus(hasEverConnected ? 'reconnecting' : 'connecting')
    inflightSettled = false
    const startedAt = Date.now()
    const promise = opts.subscribe()

    void promise.then((result) => {
      if (stopped || inflightSettled) {
        if (result.isOk()) void result.value.unsubscribe().catch(() => {})
        return
      }
      inflightSettled = true
      if (result.isErr()) {
        const err = result.error
        opts.logger.warn(
          {
            ...ctx,
            event: opts.event,
            attempt,
            kind: err.kind,
            errorMessage: scrubAddresses(err.message),
            durationMs: Date.now() - startedAt,
          },
          `${opts.event} failed`,
        )
        scheduleNext()
        return
      }
      activeSub = result.value
      attempt = 0
      // Capture before flipping the flag: onResync fires on a *re*connect
      // (this is at least the second successful connect), never the first —
      // the first snapshot is the owning service's initial subscribe path.
      const wasReconnect = hasEverConnected
      hasEverConnected = true
      setStatus('connected')
      if (wasReconnect) opts.onResync?.()
      result.value.failureSignal.addEventListener(
        'abort',
        () => {
          // Ignore a stale signal whose sub we already replaced (e.g. a forced
          // resync tore it down without aborting). Acting on it would null out
          // the *current* activeSub and spawn a spurious reconnect.
          if (stopped || activeSub !== result.value) return
          const reason: unknown = result.value.failureSignal.reason
          const rawMessage =
            reason instanceof Error
              ? reason.message
              : typeof reason === 'string'
                ? reason
                : 'SDK aborted reconnect (failureSignal)'
          opts.logger.warn(
            {
              ...ctx,
              event: opts.event,
              kind: 'failure-signal',
              errorMessage: scrubAddresses(rawMessage),
            },
            `${opts.event} failure signal`,
          )
          // Best-effort teardown of the dead handle. With a gateway multiplex
          // layer this decrements the refcount; without it, a resubscribe
          // under the same key would share a stale, already-aborted underlying
          // SDK sub and the bridge would abort synchronously, producing a
          // tight reconnect loop.
          const dead = activeSub
          activeSub = null
          if (dead !== null) void dead.unsubscribe().catch(() => {})
          scheduleNext()
        },
        { once: true },
      )
    })
  }

  function scheduleNext(): void {
    if (stopped) return
    activeSub = null
    setStatus(hasEverConnected ? 'reconnecting' : 'error')
    const ms = delayFor(attempt)
    pendingTimer = schedule(() => {
      pendingTimer = null
      tryConnect()
    }, ms)
  }

  // Forced resync (ADR-0041): tear down the live sub and reconnect now. The new
  // connect counts as a reconnect, so it runs onResync. No-op unless we are in a
  // settled `connected` state — if a connect is in flight or a retry is already
  // scheduled, that attempt will resync on its own, so we let it proceed (this
  // is the debounce against a coincident visibility + online double-fire).
  function forceReconnect(): void {
    const isReconnectPending = pendingTimer !== null
    const isConnectInFlight = activeSub === null && !inflightSettled
    if (stopped || isReconnectPending || isConnectInFlight) return
    if (activeSub !== null) {
      const dead = activeSub
      activeSub = null
      void dead.unsubscribe().catch(() => {})
    }
    attempt = 0
    tryConnect()
  }

  const resyncUnsub = opts.resyncSignal?.subscribe(forceReconnect) ?? null

  // Kick off first attempt synchronously — caller relies on a subscribe being
  // in flight by the time withReconnect returns.
  tryConnect()

  return {
    connectionStatus: {
      status() {
        return status
      },
      subscribe(onChange): Unsubscribe {
        statusListeners.add(onChange)
        return () => {
          statusListeners.delete(onChange)
        }
      },
    },
    unsubscribe() {
      if (stopped) return
      stopped = true
      if (resyncUnsub !== null) resyncUnsub()
      if (pendingTimer !== null) {
        cancel(pendingTimer)
        pendingTimer = null
      }
      if (activeSub !== null) {
        const sub = activeSub
        activeSub = null
        void sub.unsubscribe().catch(() => {})
      }
      // If a subscribe promise is still in flight, the .then() guard above
      // will tear down its result when it resolves.
      setStatus('disconnected')
    },
  }
}
