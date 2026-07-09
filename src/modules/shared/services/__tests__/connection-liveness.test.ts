import { describe, it, expect, vi } from 'vitest'
import type { Logger } from '@/modules/shared/logger'
import {
  createConnectionLiveness,
  type VisibilityTarget,
  type OnlineTarget,
} from '../connection-liveness'

// ---------- inline fakes ----------

function buildFakeLogger(): Logger {
  const noop: Logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => noop,
  }
  return noop
}

function buildFakeVisibility(initial: 'visible' | 'hidden' = 'visible') {
  const handlers = new Set<() => void>()
  let state = initial
  const target: VisibilityTarget = {
    get visibilityState() {
      return state
    },
    addEventListener: (_type, handler) => handlers.add(handler),
    removeEventListener: (_type, handler) => handlers.delete(handler),
  }
  return {
    target,
    handlerCount: () => handlers.size,
    set(next: 'visible' | 'hidden') {
      state = next
    },
    dispatch() {
      for (const h of handlers) h()
    },
  }
}

function buildFakeOnline() {
  const handlers = new Set<() => void>()
  const target: OnlineTarget = {
    addEventListener: (_type, handler) => handlers.add(handler),
    removeEventListener: (_type, handler) => handlers.delete(handler),
  }
  return {
    target,
    handlerCount: () => handlers.size,
    dispatch() {
      for (const h of handlers) h()
    },
  }
}

function buildFakeWatchdog() {
  let tick: (() => void) | null = null
  let cleared = false
  return {
    setInterval: (handler: () => void) => {
      tick = handler
      return 1
    },
    clearInterval: () => {
      cleared = true
    },
    fire() {
      tick?.()
    },
    get cleared() {
      return cleared
    },
  }
}

const STALE_AFTER_MS = 10_000

function setup(initialVisibility: 'visible' | 'hidden' = 'visible') {
  let clock = 1_000_000
  const visibility = buildFakeVisibility(initialVisibility)
  const online = buildFakeOnline()
  const watchdog = buildFakeWatchdog()
  const onResync = vi.fn()
  const liveness = createConnectionLiveness({
    logger: buildFakeLogger(),
    staleAfterMs: STALE_AFTER_MS,
    now: () => clock,
    visibility: visibility.target,
    online: online.target,
    setInterval: watchdog.setInterval,
    clearInterval: watchdog.clearInterval,
  })
  liveness.resyncSignal.subscribe(onResync)
  return {
    liveness,
    visibility,
    online,
    watchdog,
    onResync,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

// ---------- specs ----------

describe('createConnectionLiveness', () => {
  it('fires a resync when the tab becomes visible after going stale', () => {
    const t = setup()
    t.liveness.start()

    t.advance(STALE_AFTER_MS + 1) // no activity for longer than the threshold
    t.visibility.dispatch()

    expect(t.onResync).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire on resume while still fresh (quick tab flick)', () => {
    const t = setup()
    t.liveness.start()

    t.advance(STALE_AFTER_MS - 1) // under the threshold
    t.visibility.dispatch()

    expect(t.onResync).not.toHaveBeenCalled()
  })

  it('keys staleness on last activity, not hidden-duration (recent tick suppresses resync)', () => {
    const t = setup()
    t.liveness.start()

    t.advance(STALE_AFTER_MS + 100)
    t.liveness.notifyActivity() // a fresh event just arrived
    t.visibility.dispatch()

    expect(t.onResync).not.toHaveBeenCalled()
  })

  it('does not fire when the visibility event fires while hidden', () => {
    const t = setup('hidden')
    t.liveness.start()

    t.advance(STALE_AFTER_MS + 1)
    t.visibility.dispatch() // hidden → ignored

    expect(t.onResync).not.toHaveBeenCalled()
  })

  it('fires on the online event when stale', () => {
    const t = setup()
    t.liveness.start()

    t.advance(STALE_AFTER_MS + 1)
    t.online.dispatch()

    expect(t.onResync).toHaveBeenCalledTimes(1)
  })

  it('debounces a coincident visible + online double-fire into one resync', () => {
    const t = setup()
    t.liveness.start()

    t.advance(STALE_AFTER_MS + 1)
    t.visibility.dispatch() // fires + resets idle clock
    t.online.dispatch() // idle now ~0 → suppressed

    expect(t.onResync).toHaveBeenCalledTimes(1)
  })

  it('watchdog fires when stale and visible, but not while hidden', () => {
    const t = setup()
    t.liveness.start()

    t.advance(STALE_AFTER_MS + 1)
    t.visibility.set('hidden')
    t.watchdog.fire() // hidden → no resync
    expect(t.onResync).not.toHaveBeenCalled()

    t.visibility.set('visible')
    t.watchdog.fire() // visible + stale → resync
    expect(t.onResync).toHaveBeenCalledTimes(1)
  })

  it('start is idempotent and stop removes listeners + clears the watchdog', () => {
    const t = setup()
    const stop = t.liveness.start()
    t.liveness.start() // second start → no extra listeners
    expect(t.visibility.handlerCount()).toBe(1)
    expect(t.online.handlerCount()).toBe(1)

    stop()
    expect(t.visibility.handlerCount()).toBe(0)
    expect(t.online.handlerCount()).toBe(0)
    expect(t.watchdog.cleared).toBe(true)

    // After stop, a stale resume no longer fires.
    t.advance(STALE_AFTER_MS + 1)
    t.visibility.dispatch()
    expect(t.onResync).not.toHaveBeenCalled()
  })
})
