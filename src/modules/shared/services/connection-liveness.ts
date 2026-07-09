import type { ResyncSignal, Unsubscribe } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'

/**
 * Connection-liveness coordinator (ADR-0041).
 *
 * Detects a silently-dead stream socket — the case a backgrounded/suspended tab
 * produces, where the OS freezes the JS loop so no `failureSignal` ever fires —
 * and nudges every `withReconnect`-wrapped stream to tear down and resync.
 *
 * It owns no reconnect logic: it stamps "last activity" (fed from the gateway
 * fanout, one chokepoint for the shared transport) and, on a resume / online /
 * watchdog tick, runs a *staleness probe* — if no event has arrived for longer
 * than the stale threshold, it fires `resyncSignal`. `withReconnect` does the
 * actual reconnect + onResync. Keyed on last-activity (not hidden-duration) so
 * a foreground half-open socket is caught too.
 */
export interface ConnectionLiveness {
  /** Pass into every `withReconnect` callsite so a resume forces a resync. */
  readonly resyncSignal: ResyncSignal
  /** Stamp on every inbound stream event (wired into the gateway fanout). */
  notifyActivity(): void
  /** Attach visibility/online listeners + watchdog. Returns a stop fn. Idempotent. */
  start(): Unsubscribe
}

/** Structural slice of `document` — just what the probe reads. Testable. */
export interface VisibilityTarget {
  readonly visibilityState: 'visible' | 'hidden'
  addEventListener(type: 'visibilitychange', handler: () => void): void
  removeEventListener(type: 'visibilitychange', handler: () => void): void
}

/** Structural slice of `window` — just the `online` event. Testable. */
export interface OnlineTarget {
  addEventListener(type: 'online', handler: () => void): void
  removeEventListener(type: 'online', handler: () => void): void
}

export interface CreateConnectionLivenessOptions {
  readonly logger: Logger
  /** A resume/probe this long after the last event triggers a resync. Default 10s. */
  readonly staleAfterMs?: number
  /** Foreground watchdog cadence — catches a half-open socket while visible. Default 15s. */
  readonly watchdogMs?: number
  readonly now?: () => number
  readonly visibility?: VisibilityTarget
  readonly online?: OnlineTarget
  readonly setInterval?: (handler: () => void, ms: number) => unknown
  readonly clearInterval?: (handle: unknown) => void
}

const DEFAULT_STALE_AFTER_MS = 10_000
const DEFAULT_WATCHDOG_MS = 15_000

export function createConnectionLiveness(
  options: CreateConnectionLivenessOptions,
): ConnectionLiveness {
  const log = options.logger.child({ module: 'connection-liveness' })
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  const watchdogMs = options.watchdogMs ?? DEFAULT_WATCHDOG_MS
  const now = options.now ?? Date.now
  const visibility = options.visibility ?? document
  const online = options.online ?? window
  const schedule = options.setInterval ?? ((h, ms) => setInterval(h, ms))
  const cancel = options.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>))

  const resyncListeners = new Set<() => void>()
  // Seed to "now" so the first probe right after mount never fires spuriously
  // before any event has had a chance to arrive.
  let lastActivityAt = now()
  let started = false

  const resyncSignal: ResyncSignal = {
    subscribe(onResync: () => void): Unsubscribe {
      resyncListeners.add(onResync)
      return () => {
        resyncListeners.delete(onResync)
      }
    },
  }

  function notifyActivity(): void {
    lastActivityAt = now()
  }

  // Probe: fire a resync only if the stream looks stale. Stamping lastActivityAt
  // on fire resets the idle clock, which both debounces a coincident
  // visible+online double-fire and gives the forced reconnect time to produce
  // fresh events before the watchdog probes again.
  function probe(trigger: string): void {
    const idleMs = now() - lastActivityAt
    const isStale = idleMs > staleAfterMs
    if (!isStale) return
    lastActivityAt = now()
    log.info({ trigger, idleMs, listeners: resyncListeners.size }, 'resync requested')
    for (const onResync of resyncListeners) onResync()
  }

  function onVisibilityChange(): void {
    const isVisible = visibility.visibilityState === 'visible'
    if (!isVisible) return
    probe('visibilitychange')
  }

  function onOnline(): void {
    probe('online')
  }

  function onWatchdogTick(): void {
    const isVisible = visibility.visibilityState === 'visible'
    if (!isVisible) return
    probe('watchdog')
  }

  function start(): Unsubscribe {
    if (started) return () => {}
    started = true
    visibility.addEventListener('visibilitychange', onVisibilityChange)
    online.addEventListener('online', onOnline)
    const watchdog = schedule(onWatchdogTick, watchdogMs)
    log.info({ staleAfterMs, watchdogMs }, 'liveness started')
    return () => {
      if (!started) return
      started = false
      visibility.removeEventListener('visibilitychange', onVisibilityChange)
      online.removeEventListener('online', onOnline)
      cancel(watchdog)
    }
  }

  return { resyncSignal, notifyActivity, start }
}
