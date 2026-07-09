import type { ConnectionStatus, ConnectionStatusSource, Unsubscribe } from '../domain'
import type { Logger } from '../logger'

export type ConnectionHealth = 'healthy' | 'degraded' | 'dead'

export interface ConnectionSupervisorSnapshot {
  readonly health: ConnectionHealth
  readonly degradedSinceMs: number | null
  readonly lastTickAt: number | null
  readonly stallSeconds: number | null
}

export interface ConnectionSupervisor {
  readonly snapshot: () => ConnectionSupervisorSnapshot
  readonly subscribe: (onChange: (snapshot: ConnectionSupervisorSnapshot) => void) => Unsubscribe
  /** Mark a data tick from any monitored stream (resets staleness). */
  readonly notifyTick: () => void
  /** Stop polling timers and tear down. Idempotent. */
  readonly stop: () => void
}

export interface ConnectionSupervisorOptions {
  /** Connection-status sources to aggregate. Empty list is allowed (e.g. mock venue). */
  readonly statusSources: ReadonlyArray<ConnectionStatusSource>
  readonly logger: Logger
  /** Milliseconds of continuous non-`connected` aggregate state before reporting `degraded`. */
  readonly degradedAfterMs?: number
  /** Milliseconds of continuous non-`connected` aggregate state before reporting `dead`. */
  readonly deadAfterMs?: number
  /** Milliseconds without a `notifyTick()` while at least one source is `connected` before reporting `degraded`. */
  readonly staleAfterMs?: number
  /** Polling interval used to recompute time-derived state. */
  readonly tickIntervalMs?: number
  /** Override for tests. */
  readonly now?: () => number
  /** Override for tests. */
  readonly setInterval?: (handler: () => void, ms: number) => unknown
  /** Override for tests. */
  readonly clearInterval?: (handle: unknown) => void
}

const DEFAULT_DEGRADED_MS = 8_000
const DEFAULT_DEAD_MS = 20_000
const DEFAULT_STALE_MS = 30_000
const DEFAULT_TICK_MS = 1_000

/**
 * Cross-stream health supervisor.
 *
 * Watches N `ConnectionStatusSource`s plus a data-flow tick signal and emits a
 * three-state `ConnectionHealth` (`healthy | degraded | dead`):
 *
 * - **`healthy`** — no source is in a genuine-failure state (or one is still
 *   `connected`), AND we have either seen a `notifyTick()` recently OR no source
 *   has ever been connected yet (clean first-load).
 * - **`degraded`** — a source has been in a genuine-failure state
 *   (`reconnecting` / `error`) with no source `connected` for ≥ `degradedAfterMs`
 *   (option B: shared transport / cross-stream failure), OR a connected source
 *   has not produced a `notifyTick()` for ≥ `staleAfterMs` (option C:
 *   data-flow watchdog — "connection looks fine, data isn't flowing").
 * - **`dead`** — degraded condition has held for ≥ `deadAfterMs`. The recovery
 *   button calls a venue rebuild; that rebuild kicks all retry attempts.
 *
 * **Intentional teardown is not a failure (issue #259, decision B).** A source
 * in `disconnected` (no address / explicitly stopped — e.g. an Account-keyed
 * stream after the user logs out) or `connecting` (pre-first-connect) is
 * *excluded* from the down-aggregate: it is an idle/intentional state, not a
 * connectivity loss. Only `reconnecting` / `error` — the states `withReconnect`
 * emits when a live stream genuinely fails — count as "down". Because the venue
 * multiplexes Account-keyed and public streams over one shared transport, a real
 * transport stall still surfaces as `reconnecting` / `error` and raises the
 * banner, while a clean logout (which drives the stream to `disconnected`) never
 * does.
 */
export function createConnectionSupervisor(
  options: ConnectionSupervisorOptions,
): ConnectionSupervisor {
  const degradedAfterMs = options.degradedAfterMs ?? DEFAULT_DEGRADED_MS
  const deadAfterMs = options.deadAfterMs ?? DEFAULT_DEAD_MS
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_MS
  const tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_MS
  const now = options.now ?? Date.now
  const schedule = options.setInterval ?? ((h, ms) => setInterval(h, ms))
  const cancel = options.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>))
  const log = options.logger.child({ module: 'connection-supervisor' })

  const statuses: ConnectionStatus[] = options.statusSources.map((s) => s.status())
  const statusUnsubs: Unsubscribe[] = []
  let lastTickAt: number | null = null
  let hasEverBeenConnected = false
  // "Down" = a genuine failure with nothing currently connected (issue #259).
  // Intentional teardown (`disconnected`) and pre-first-connect (`connecting`)
  // are NOT down — see the factory doc comment.
  let downSinceMs: number | null = isAggregateDownNow() ? now() : null
  let snapshot: ConnectionSupervisorSnapshot = buildSnapshot()
  const listeners = new Set<(s: ConnectionSupervisorSnapshot) => void>()
  let stopped = false

  function isConnectedStatus(s: ConnectionStatus): boolean {
    return s === 'connected'
  }

  // A live stream that genuinely failed. `withReconnect` emits these only after
  // a real connectivity loss — never on an intentional unsubscribe/logout.
  function isGenuineFailure(s: ConnectionStatus): boolean {
    return s === 'reconnecting' || s === 'error'
  }

  function someConnected(): boolean {
    return statuses.some(isConnectedStatus)
  }

  function someGenuineFailure(): boolean {
    return statuses.some(isGenuineFailure)
  }

  // Down iff something is genuinely failing AND nothing is holding a connection.
  function isAggregateDownNow(): boolean {
    return someGenuineFailure() && !someConnected()
  }

  function buildSnapshot(): ConnectionSupervisorSnapshot {
    const t = now()
    const isCurrentlyConnected = someConnected()
    const hasTickRef = lastTickAt !== null
    const stallSeconds = hasTickRef ? Math.max(0, Math.floor((t - (lastTickAt ?? t)) / 1000)) : null

    // Aggregate down duration — measured from the first genuine-failure tick
    // with nothing connected. `disconnected` (logout) never starts this clock.
    const downMs = downSinceMs === null ? 0 : t - downSinceMs
    const isAggregateDown = downSinceMs !== null
    const isAggregateDegraded = isAggregateDown && downMs >= degradedAfterMs
    const isAggregateDead = isAggregateDown && downMs >= deadAfterMs

    // Staleness: a connected source that hasn't ticked in `staleAfterMs` is a
    // strong signal that the WS is alive but the server isn't pushing.
    const stalenessMs = lastTickAt === null ? 0 : t - lastTickAt
    const isStale = isCurrentlyConnected && hasEverBeenConnected && stalenessMs >= staleAfterMs

    const health: ConnectionHealth = (() => {
      if (isAggregateDead) return 'dead'
      if (isAggregateDegraded || isStale) return 'degraded'
      return 'healthy'
    })()

    const degradedSinceMs = (() => {
      if (health === 'healthy') return null
      if (isAggregateDown && downSinceMs !== null) return downSinceMs
      if (isStale && lastTickAt !== null) return lastTickAt + staleAfterMs
      return null
    })()

    return {
      health,
      degradedSinceMs,
      lastTickAt,
      stallSeconds,
    }
  }

  function recomputeAndEmit(): void {
    if (stopped) return
    const next = buildSnapshot()
    const changed =
      next.health !== snapshot.health ||
      next.degradedSinceMs !== snapshot.degradedSinceMs ||
      next.stallSeconds !== snapshot.stallSeconds
    if (!changed) return
    const previous = snapshot
    snapshot = next
    if (previous.health !== next.health) {
      log.info({ from: previous.health, to: next.health }, 'health')
    }
    for (const listener of listeners) listener(snapshot)
  }

  function onSourceStatus(index: number, next: ConnectionStatus): void {
    statuses[index] = next
    if (someConnected()) hasEverBeenConnected = true
    // Start the down clock on the first genuine-failure-with-nothing-connected
    // tick; clear it the moment that condition lifts (a reconnect, or a clean
    // teardown to `disconnected`).
    downSinceMs = isAggregateDownNow() ? downSinceMs ?? now() : null
    recomputeAndEmit()
  }

  for (let i = 0; i < options.statusSources.length; i += 1) {
    const source = options.statusSources[i]
    const unsub = source.subscribe((next) => onSourceStatus(i, next))
    statusUnsubs.push(unsub)
  }
  if (someConnected()) hasEverBeenConnected = true

  const intervalHandle = schedule(() => {
    recomputeAndEmit()
  }, tickIntervalMs)

  return {
    snapshot() {
      return snapshot
    },
    subscribe(onChange) {
      listeners.add(onChange)
      onChange(snapshot)
      return () => {
        listeners.delete(onChange)
      }
    },
    notifyTick() {
      if (stopped) return
      lastTickAt = now()
      recomputeAndEmit()
    },
    stop() {
      if (stopped) return
      stopped = true
      cancel(intervalHandle)
      for (const u of statusUnsubs) u()
      statusUnsubs.length = 0
      listeners.clear()
    },
  }
}
