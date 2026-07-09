import { describe, it, expect, vi } from 'vitest'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import type { LogFields, LogLevel, Logger } from '@/modules/shared/logger'
import {
  withReconnect,
  type ReconnectableGatewayError,
  type ReconnectableSubscription,
} from '../with-reconnect'

// ---------- inline fakes (no venue dependency) ----------

interface TimerHandle {
  readonly id: number
  readonly run: () => void
}

function buildFakeTimers() {
  const queue: TimerHandle[] = []
  let nextId = 1
  return {
    setTimeout: (handler: () => void) => {
      const id = nextId++
      queue.push({ id, run: handler })
      return id
    },
    clearTimeout: (handle: unknown) => {
      const idx = queue.findIndex((q) => q.id === handle)
      if (idx >= 0) queue.splice(idx, 1)
    },
    flushOne(): boolean {
      const next = queue.shift()
      if (next === undefined) return false
      next.run()
      return true
    },
    pending(): number {
      return queue.length
    },
  }
}

interface LogRecord {
  readonly level: LogLevel
  readonly fields: LogFields
  readonly message: string
}

interface FakeLogger {
  readonly logger: Logger
  readonly records: ReadonlyArray<LogRecord>
}

function buildFakeLogger(): FakeLogger {
  const records: LogRecord[] = []
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
  return { logger: build({}), records }
}

function makeSub(failureController: AbortController): ReconnectableSubscription {
  return {
    unsubscribe: () => Promise.resolve(),
    failureSignal: failureController.signal,
  }
}

function makeError(kind: string, message: string): ReconnectableGatewayError {
  return { kind, message }
}

const NET_ERR = makeError('network', 'boom')

type FakeSubResult = ResultAsync<ReconnectableSubscription, ReconnectableGatewayError>

// ---------- specs ----------

describe('withReconnect', () => {
  it('connects on first attempt and exposes status `connected`', async () => {
    const ctl = new AbortController()
    const subscribe = vi.fn((): FakeSubResult => okAsync(makeSub(ctl)))
    const fake = buildFakeLogger()
    const handle = withReconnect({ subscribe, logger: fake.logger, event: 'l2Book subscribe' })

    await Promise.resolve()
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('connected')
    expect(subscribe).toHaveBeenCalledTimes(1)
    handle.unsubscribe()
  })

  it('retries on subscribe failure and reaches `connected` on the second attempt', async () => {
    const ctl = new AbortController()
    let calls = 0
    const subscribe = vi.fn((): FakeSubResult => {
      calls += 1
      return calls === 1 ? errAsync(NET_ERR) : okAsync(makeSub(ctl))
    })
    const timers = buildFakeTimers()
    const fake = buildFakeLogger()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'trades subscribe',
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      random: () => 1,
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(handle.connectionStatus.status()).toBe('error')

    expect(timers.pending()).toBe(1)
    timers.flushOne()
    await Promise.resolve()
    await Promise.resolve()
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(handle.connectionStatus.status()).toBe('connected')

    const failure = fake.records.find((r) => r.message === 'trades subscribe failed')
    expect(failure?.fields).toMatchObject({ attempt: 1, kind: 'network' })

    handle.unsubscribe()
  })

  it('reconnects when failureSignal aborts after a successful connect', async () => {
    let ctl = new AbortController()
    let calls = 0
    const subscribe = vi.fn((): FakeSubResult => {
      calls += 1
      if (calls === 1) return okAsync(makeSub(ctl))
      ctl = new AbortController()
      return okAsync(makeSub(ctl))
    })
    const timers = buildFakeTimers()
    const fake = buildFakeLogger()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'l2Book subscribe',
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      random: () => 0.5,
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('connected')

    ctl.abort(new Error('socket closed'))
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('reconnecting')
    expect(timers.pending()).toBe(1)

    timers.flushOne()
    await Promise.resolve()
    await Promise.resolve()
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(handle.connectionStatus.status()).toBe('connected')

    handle.unsubscribe()
  })

  it('unsubscribe cancels pending retry timer and stops further attempts', async () => {
    const subscribe = vi.fn((): FakeSubResult => errAsync(NET_ERR))
    const timers = buildFakeTimers()
    const fake = buildFakeLogger()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'candle subscribe',
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(timers.pending()).toBe(1)

    handle.unsubscribe()
    expect(timers.pending()).toBe(0)
    expect(handle.connectionStatus.status()).toBe('disconnected')
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('calls onResync on a reconnect-success but not on the first connect', async () => {
    let ctl = new AbortController()
    let calls = 0
    const subscribe = vi.fn((): FakeSubResult => {
      calls += 1
      if (calls === 1) return okAsync(makeSub(ctl))
      ctl = new AbortController()
      return okAsync(makeSub(ctl))
    })
    const timers = buildFakeTimers()
    const fake = buildFakeLogger()
    const onResync = vi.fn()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'candle subscribe',
      onResync,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      random: () => 0.5,
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('connected')
    expect(onResync).not.toHaveBeenCalled() // first connect → no resync

    ctl.abort(new Error('socket closed'))
    await Promise.resolve()
    timers.flushOne()
    await Promise.resolve()
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('connected')
    expect(onResync).toHaveBeenCalledTimes(1) // reconnect → resync

    handle.unsubscribe()
  })

  it('resyncSignal forces a reconnect that tears down the live sub and runs onResync', async () => {
    const subs: Array<{ ctl: AbortController; unsubscribe: ReturnType<typeof vi.fn> }> = []
    const subscribe = vi.fn((): FakeSubResult => {
      const ctl = new AbortController()
      const unsubscribe = vi.fn(() => Promise.resolve())
      subs.push({ ctl, unsubscribe })
      return okAsync({ failureSignal: ctl.signal, unsubscribe })
    })
    let fireResync: () => void = () => {}
    const resyncSignal = {
      subscribe(onResync: () => void) {
        fireResync = onResync
        return () => {}
      },
    }
    const timers = buildFakeTimers()
    const fake = buildFakeLogger()
    const onResync = vi.fn()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'l2Book subscribe',
      onResync,
      resyncSignal,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      random: () => 0.5,
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(handle.connectionStatus.status()).toBe('connected')

    fireResync()
    await Promise.resolve()
    await Promise.resolve()
    expect(subs[0].unsubscribe).toHaveBeenCalledTimes(1) // old sub torn down
    expect(subscribe).toHaveBeenCalledTimes(2) // reconnected immediately
    expect(handle.connectionStatus.status()).toBe('connected')
    expect(onResync).toHaveBeenCalledTimes(1)

    handle.unsubscribe()
  })

  it('resyncSignal is a no-op while a reconnect is already pending', async () => {
    let ctl = new AbortController()
    const subscribe = vi.fn((): FakeSubResult => {
      ctl = new AbortController()
      return okAsync(makeSub(ctl))
    })
    let fireResync: () => void = () => {}
    const resyncSignal = {
      subscribe(onResync: () => void) {
        fireResync = onResync
        return () => {}
      },
    }
    const timers = buildFakeTimers()
    const fake = buildFakeLogger()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'candle subscribe',
      resyncSignal,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      random: () => 0.5,
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('connected')

    // Drop into a scheduled-reconnect state via failureSignal.
    ctl.abort(new Error('drop'))
    await Promise.resolve()
    expect(handle.connectionStatus.status()).toBe('reconnecting')
    expect(timers.pending()).toBe(1)
    expect(subscribe).toHaveBeenCalledTimes(1)

    fireResync() // a retry is already scheduled → ignored, no extra subscribe
    expect(timers.pending()).toBe(1)
    expect(subscribe).toHaveBeenCalledTimes(1)

    handle.unsubscribe()
  })

  it('resets backoff to 0 attempts after a successful connect', async () => {
    let calls = 0
    const ctls: AbortController[] = []
    const subscribe = vi.fn((): FakeSubResult => {
      calls += 1
      if (calls === 1) return errAsync(NET_ERR)
      const ctl = new AbortController()
      ctls.push(ctl)
      return okAsync(makeSub(ctl))
    })

    const delays: number[] = []
    const setTimeoutSpy = (handler: () => void, ms: number) => {
      delays.push(ms)
      Promise.resolve().then(handler)
      return 0
    }
    const fake = buildFakeLogger()
    const handle = withReconnect({
      subscribe,
      logger: fake.logger,
      event: 'l2Book subscribe',
      setTimeout: setTimeoutSpy,
      clearTimeout: () => {},
      random: () => 1,
      backoff: { baseMs: 100, maxMs: 1_000, factor: 2, jitter: true },
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(handle.connectionStatus.status()).toBe('connected')
    expect(delays[0]).toBe(200)

    ctls[0].abort(new Error('drop'))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(delays[1]).toBe(100)

    handle.unsubscribe()
  })
})
