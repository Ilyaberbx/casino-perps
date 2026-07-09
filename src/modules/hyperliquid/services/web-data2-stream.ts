import type { ConnectionStatus, ConnectionStatusSource, ResyncSignal, Unsubscribe, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway'
import type { WebData2Response } from '../gateway/sdk-types'
import { withReconnect, type WithReconnectHandle } from '@/modules/shared/services/with-reconnect'

export interface WebData2Stream {
  current(): WebData2Response | null
  subscribe(onUpdate: (state: WebData2Response) => void): Unsubscribe
  connectionStatus: ConnectionStatusSource
  /** Force re-evaluation of the address (e.g. when the wallet rotates). */
  refreshAddress(): void
  /** Stop subscribing and tear down. */
  stop(): void
}

export interface CreateWebData2StreamOptions {
  readonly gateway: HyperliquidGateway
  readonly getAddress: () => WalletAddress | null
  readonly logger: Logger
  /** Override timer in tests. Forwarded to `withReconnect`. */
  readonly setTimeout?: (handler: () => void, ms: number) => unknown
  /** Override timer cancellation in tests. Forwarded to `withReconnect`. */
  readonly clearTimeout?: (handle: unknown) => void
  /** Override jitter source in tests. Forwarded to `withReconnect`. */
  readonly random?: () => number
  /** Liveness source forwarded to withReconnect for resume-driven resync (ADR-0041). */
  readonly resyncSignal?: ResyncSignal
}

/**
 * Single live `webData2` subscription, fanned out to N reader-listeners.
 * Wraps the SDK sub in `withReconnect` (ADR-0010 amendment, 2026-05-20): the
 * SDK's internal retry budget is exhausted within a few minutes of flaky
 * network conditions, after which `failureSignal` aborts and the channel is
 * dead. `withReconnect` resubscribes with exponential backoff (250ms → 30s,
 * ×2, jittered) — the same policy already battle-tested on `l2Book`, `trades`,
 * and `candle`.
 *
 * `ConnectionStatus` mapping (mirrors withReconnect):
 * - `disconnected` → no address available, or stopped, or not yet subscribed.
 * - `connecting`   → first subscribe-promise pending.
 * - `connected`    → subscribe-promise resolved; receiving updates.
 * - `reconnecting` → mid-stream `failureSignal` aborted; backoff timer pending.
 * - `error`        → first subscribe-promise rejected before any success.
 */
export function createWebData2Stream(options: CreateWebData2StreamOptions): WebData2Stream {
  const { gateway, getAddress } = options
  const log = options.logger.child({ module: 'hyperliquid-stream' })
  log.debug({}, 'init')

  let latest: WebData2Response | null = null
  const dataListeners = new Set<(s: WebData2Response) => void>()
  const statusListeners = new Set<(s: ConnectionStatus) => void>()
  let status: ConnectionStatus = 'disconnected'
  let activeHandle: WithReconnectHandle | null = null
  let activeStatusUnsub: Unsubscribe | null = null
  let activeAddress: WalletAddress | null = null
  let stopped = false

  function setStatus(next: ConnectionStatus): void {
    if (status === next) return
    status = next
    for (const listener of statusListeners) listener(status)
  }

  function emit(data: WebData2Response): void {
    latest = data
    log.debug({}, 'tick')
    for (const listener of dataListeners) listener(data)
  }

  function teardownActive(): void {
    if (activeStatusUnsub !== null) {
      activeStatusUnsub()
      activeStatusUnsub = null
    }
    if (activeHandle !== null) {
      log.info({ address: formatAddress(activeAddress) }, 'unsubscribe')
      activeHandle.unsubscribe()
      activeHandle = null
    }
    activeAddress = null
  }

  function ensureSubscribed(): void {
    if (stopped) return
    const address = getAddress()
    const isAddressMissing = address === null
    if (isAddressMissing) {
      // Diagnostic: surface the silent-bail once per transition into the
      // disconnected state — without it, an unconfigured / unlinked wallet
      // looks identical in the log stream to "stream never created".
      const wasConnected = activeAddress !== null
      if (wasConnected) log.info({}, 'no address; staying disconnected')
      teardownActive()
      latest = null
      setStatus('disconnected')
      return
    }
    const isSameAddress = activeAddress === address
    if (isSameAddress) return
    const previousAddress = activeAddress
    teardownActive()
    activeAddress = address
    // Invalidate the stale cache on a genuine address rotation — otherwise
    // subscribe()'s synchronous replay below hands the PREVIOUS address's data
    // to a new/rerouted listener (e.g. acting-account-sources.ts's spectate
    // convergence reroute) until the fresh tick for `address` lands.
    latest = null
    log.info(
      { from: formatAddress(previousAddress), to: formatAddress(address) },
      'subscribe',
    )

    const handle = withReconnect({
      subscribe: () =>
        gateway.subscribeWebData2(address, (data) => {
          // Drop ticks from a stale subscription (address rotated mid-flight).
          if (activeAddress !== address) return
          emit(data)
        }),
      logger: log,
      logContext: { address: formatAddress(address) },
      event: 'webData2 subscribe',
      setTimeout: options.setTimeout,
      clearTimeout: options.clearTimeout,
      random: options.random,
      resyncSignal: options.resyncSignal,
    })
    activeHandle = handle
    activeStatusUnsub = handle.connectionStatus.subscribe((next) => {
      if (activeHandle !== handle) return
      setStatus(next)
    })
    setStatus(handle.connectionStatus.status())
  }

  return {
    current() {
      return latest
    },
    subscribe(onUpdate) {
      log.debug({ count: dataListeners.size + 1 }, 'data subscribe')
      dataListeners.add(onUpdate)
      ensureSubscribed()
      if (latest !== null) onUpdate(latest)
      return () => {
        dataListeners.delete(onUpdate)
      }
    },
    connectionStatus: {
      status() {
        return status
      },
      subscribe(onChange) {
        // Replay the current status to the new subscriber (matches the data
        // `subscribe` above, mock-venue's `connection`, and the connection
        // supervisor). A subscriber that mounts AFTER the shared connection is
        // already `connected` — e.g. the account dock behind a lazy route chunk
        // / auth gate — would otherwise never learn the venue is connected,
        // since `setStatus` only fires on change. Replay BEFORE
        // `ensureSubscribed()` so the subscriber sees the current status first,
        // then any transition `ensureSubscribed()` triggers — not a duplicate of
        // that transition.
        onChange(status)
        statusListeners.add(onChange)
        ensureSubscribed()
        return () => {
          statusListeners.delete(onChange)
        }
      },
    },
    refreshAddress() {
      const before = activeAddress
      const next = getAddress()
      // Revival: a refreshAddress call is the consumer asking us to be
      // subscribed for `next`. If a prior stop() left us with stopped=true
      // (most commonly: React 19 StrictMode dev ran the dispose cleanup on
      // the cached venue between mount and re-mount), we must clear the flag
      // here. Otherwise ensureSubscribed bails forever and webData2 never
      // resubscribes when the wallet address resolves from null to real.
      if (stopped) {
        log.info({}, 'refresh after stop — reviving')
        stopped = false
      }
      log.debug(
        { from: formatAddress(before), to: formatAddress(next) },
        'refresh address',
      )
      ensureSubscribed()
    },
    stop() {
      stopped = true
      teardownActive()
      latest = null
      setStatus('disconnected')
    },
  }
}
