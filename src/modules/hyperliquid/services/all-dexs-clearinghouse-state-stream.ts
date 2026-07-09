import type { ConnectionStatus, ConnectionStatusSource, ResyncSignal, Unsubscribe, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway'
import type { AllDexsClearinghouseStateEvent } from '../gateway/sdk-types'
import { withReconnect, type WithReconnectHandle } from '@/modules/shared/services/with-reconnect'

export interface AllDexsClearinghouseStateStream {
  current(): AllDexsClearinghouseStateEvent | null
  subscribe(onUpdate: (state: AllDexsClearinghouseStateEvent) => void): Unsubscribe
  connectionStatus: ConnectionStatusSource
  /** Force re-evaluation of the address (e.g. when the wallet rotates). */
  refreshAddress(): void
  /** Stop subscribing and tear down. */
  stop(): void
}

export interface CreateAllDexsClearinghouseStateStreamOptions {
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
 * Single live `allDexsClearinghouseState` subscription, fanned out to N
 * reader-listeners. This event carries clearinghouse state for the main perp
 * dex (`dex === ''`) PLUS every HIP-3 dex in one payload, so it is the sole
 * source for all perp positions (main + HIP-3) — see the perps-positions
 * snapshot reader. Wraps the SDK sub in `withReconnect` (the same policy
 * battle-tested on `webData2`, `l2Book`, `trades`, and `candle`): the SDK's
 * internal retry budget is exhausted within a few minutes of flaky network,
 * after which `failureSignal` aborts and the channel is dead.
 *
 * `ConnectionStatus` mapping (mirrors withReconnect):
 * - `disconnected` → no address available, or stopped, or not yet subscribed.
 * - `connecting`   → first subscribe-promise pending.
 * - `connected`    → subscribe-promise resolved; receiving updates.
 * - `reconnecting` → mid-stream `failureSignal` aborted; backoff timer pending.
 * - `error`        → first subscribe-promise rejected before any success.
 */
export function createAllDexsClearinghouseStateStream(
  options: CreateAllDexsClearinghouseStateStreamOptions,
): AllDexsClearinghouseStateStream {
  const { gateway, getAddress } = options
  const log = options.logger.child({ module: 'hyperliquid-stream' })
  log.debug({}, 'init')

  let latest: AllDexsClearinghouseStateEvent | null = null
  const dataListeners = new Set<(s: AllDexsClearinghouseStateEvent) => void>()
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

  function emit(data: AllDexsClearinghouseStateEvent): void {
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
        gateway.subscribeAllDexsClearinghouseState(address, (data) => {
          // Drop ticks from a stale subscription (address rotated mid-flight).
          if (activeAddress !== address) return
          emit(data)
        }),
      logger: log,
      logContext: { address: formatAddress(address) },
      event: 'allDexsClearinghouseState subscribe',
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
      // here. Otherwise ensureSubscribed bails forever and the channel never
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
