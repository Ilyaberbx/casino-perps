import { describe, it, expect } from 'vitest'
import type { ConnectionStatus, ConnectionStatusSource, Unsubscribe } from '../../domain'
import type { LogFields, LogLevel, Logger } from '../../logger'
import { createConnectionSupervisor } from '../connection-supervisor'

interface FakeClock {
  now(): number
  advance(ms: number): void
  setInterval: (handler: () => void, ms: number) => unknown
  clearInterval: (handle: unknown) => void
  /** Run the next timer manually. */
  tick(): void
}

interface FakeStatusSource extends ConnectionStatusSource {
  set(status: ConnectionStatus): void
}

interface FakeLogger {
  readonly logger: Logger
}

function buildFakeLogger(): FakeLogger {
  const records: Array<{ level: LogLevel; fields: LogFields; message: string }> = []
  function build(bound: LogFields): Logger {
    function emit(level: LogLevel, fields: LogFields, message: string): void {
      records.push({ level, fields: { ...bound, ...fields }, message })
    }
    return {
      debug: (fields, message) => emit('debug', fields, message),
      info: (fields, message) => emit('info', fields, message),
      warn: (fields, message) => emit('warn', fields, message),
      error: (fields, message) => emit('error', fields, message),
      child: (fields) => build({ ...bound, ...fields }),
    }
  }
  return { logger: build({}) }
}

function buildFakeClock(): FakeClock {
  let current = 0
  const handlers: Array<{ handler: () => void; intervalMs: number; nextAt: number }> = []
  function fire(at: number): void {
    for (const h of handlers) {
      const shouldFire = h.nextAt <= at
      if (!shouldFire) continue
      h.handler()
      h.nextAt = at + h.intervalMs
    }
  }
  return {
    now: () => current,
    advance: (ms) => {
      current += ms
      fire(current)
    },
    setInterval: (handler, ms) => {
      const entry = { handler, intervalMs: ms, nextAt: current + ms }
      handlers.push(entry)
      return entry
    },
    clearInterval: (handle) => {
      const idx = handlers.indexOf(handle as (typeof handlers)[number])
      if (idx >= 0) handlers.splice(idx, 1)
    },
    tick: () => {
      const next = handlers[0]
      if (next === undefined) return
      next.handler()
      next.nextAt = current + next.intervalMs
    },
  }
}

function buildFakeStatusSource(initial: ConnectionStatus): FakeStatusSource {
  let status = initial
  const listeners = new Set<(s: ConnectionStatus) => void>()
  return {
    status: () => status,
    subscribe(onChange): Unsubscribe {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    set(next) {
      if (status === next) return
      status = next
      for (const l of listeners) l(next)
    },
  }
}

describe('createConnectionSupervisor', () => {
  it('reports `healthy` while at least one source is connected', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const log = buildFakeLogger()
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: log.logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    })
    expect(sup.snapshot().health).toBe('healthy')
    sup.stop()
  })

  it('does not flag pre-first-connect non-connected state as degraded', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connecting')
    const log = buildFakeLogger()
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: log.logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      degradedAfterMs: 1000,
    })
    clock.advance(10_000)
    expect(sup.snapshot().health).toBe('healthy')
    sup.stop()
  })

  it('reports `degraded` after sustained drop following a connect', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const log = buildFakeLogger()
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: log.logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      degradedAfterMs: 5_000,
      deadAfterMs: 20_000,
    })
    src.set('reconnecting')
    clock.advance(6_000)
    expect(sup.snapshot().health).toBe('degraded')
    sup.stop()
  })

  it('escalates to `dead` after deadAfterMs of continuous degradation', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: buildFakeLogger().logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      degradedAfterMs: 5_000,
      deadAfterMs: 20_000,
    })
    src.set('error')
    clock.advance(25_000)
    expect(sup.snapshot().health).toBe('dead')
    sup.stop()
  })

  it('reports `degraded` on data staleness even when status says connected', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: buildFakeLogger().logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      staleAfterMs: 30_000,
    })
    // Seed a tick at t=0, then sit idle.
    sup.notifyTick()
    clock.advance(35_000)
    expect(sup.snapshot().health).toBe('degraded')
    sup.stop()
  })

  it('stays `healthy` when a connected source is torn down to `disconnected` (logout)', () => {
    // Issue #259: logging out drives the Account-keyed stream to `disconnected`
    // (no address). That is an intentional teardown, not a connectivity loss —
    // it must never escalate to degraded/dead.
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: buildFakeLogger().logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      degradedAfterMs: 5_000,
      deadAfterMs: 20_000,
    })
    src.set('disconnected')
    clock.advance(25_000)
    expect(sup.snapshot().health).toBe('healthy')
    sup.stop()
  })

  it('still surfaces `degraded` on a genuine failure after a prior clean teardown', () => {
    // A logout (`disconnected`) followed later by a re-login that genuinely
    // fails (`reconnecting`) must still raise the banner.
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: buildFakeLogger().logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      degradedAfterMs: 5_000,
    })
    src.set('disconnected')
    clock.advance(30_000)
    expect(sup.snapshot().health).toBe('healthy')
    src.set('reconnecting')
    clock.advance(6_000)
    expect(sup.snapshot().health).toBe('degraded')
    sup.stop()
  })

  it('recovers to `healthy` when a source reconnects', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: buildFakeLogger().logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      degradedAfterMs: 1_000,
    })
    src.set('error')
    clock.advance(5_000)
    expect(sup.snapshot().health).toBe('degraded')
    src.set('connected')
    expect(sup.snapshot().health).toBe('healthy')
    sup.stop()
  })

  it('stop() cancels the timer and silences listeners', () => {
    const clock = buildFakeClock()
    const src = buildFakeStatusSource('connected')
    const sup = createConnectionSupervisor({
      statusSources: [src],
      logger: buildFakeLogger().logger,
      now: clock.now,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
    })
    let calls = 0
    sup.subscribe(() => {
      calls += 1
    })
    sup.stop()
    const before = calls
    src.set('error')
    clock.advance(60_000)
    expect(calls).toBe(before)
  })
})
