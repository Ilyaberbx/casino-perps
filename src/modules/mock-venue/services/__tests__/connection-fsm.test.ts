import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createConnectionFsm } from '../connection-fsm'
import type { ConnectionFsmStatus } from '../../mock-venue.types'

describe('createConnectionFsm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in connected state', () => {
    const fsm = createConnectionFsm({ rng: Math.random, onChange: () => {} })
    expect(fsm.status()).toBe('connected')
    fsm.dispose()
  })

  it('rejects reconnecting -> reconnecting transition (already reconnecting)', () => {
    const fsm = createConnectionFsm({ rng: Math.random, onChange: () => {} })
    fsm.simulateDisconnect()
    expect(() => fsm.simulateDisconnect()).toThrow()
    fsm.dispose()
  })

  it('rejects connected -> connected transition (already connected)', () => {
    const fsm = createConnectionFsm({ rng: Math.random, onChange: () => {} })
    expect(() => fsm.simulateReconnect()).toThrow()
    fsm.dispose()
  })

  it('transitions connected -> reconnecting on simulateDisconnect', () => {
    const onChange = vi.fn()
    const fsm = createConnectionFsm({ rng: Math.random, onChange })
    fsm.simulateDisconnect()
    expect(fsm.status()).toBe('reconnecting')
    expect(onChange).toHaveBeenCalledWith('reconnecting')
    fsm.dispose()
  })

  it('transitions reconnecting -> connected on simulateReconnect', () => {
    const onChange = vi.fn()
    const fsm = createConnectionFsm({ rng: Math.random, onChange })
    fsm.simulateDisconnect()
    onChange.mockClear()
    fsm.simulateReconnect()
    expect(fsm.status()).toBe('connected')
    expect(onChange).toHaveBeenCalledWith('connected')
    fsm.dispose()
  })

  it('fires callbacks in transition order: reconnecting then connected', () => {
    const callOrder: ConnectionFsmStatus[] = []
    const fsm = createConnectionFsm({
      rng: Math.random,
      onChange: (status) => callOrder.push(status),
    })
    fsm.simulateDisconnect()
    fsm.simulateReconnect()
    expect(callOrder).toEqual(['reconnecting', 'connected'])
    fsm.dispose()
  })

  it('schedules automatic reconnect within 1–3s after disconnect', () => {
    const onChange = vi.fn()
    const alwaysMinRng = () => 0
    const fsm = createConnectionFsm({ rng: alwaysMinRng, onChange })
    fsm.simulateDisconnect()
    onChange.mockClear()
    vi.advanceTimersByTime(999)
    expect(fsm.status()).toBe('reconnecting')
    vi.advanceTimersByTime(1)
    expect(fsm.status()).toBe('connected')
    expect(onChange).toHaveBeenCalledWith('connected')
    fsm.dispose()
  })

  it('schedules next disconnect after reconnect using rng for 2–5 min interval', () => {
    const alwaysMinRng = () => 0
    const onChange = vi.fn()
    const fsm = createConnectionFsm({ rng: alwaysMinRng, onChange })
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(onChange).toHaveBeenCalledWith('reconnecting')
    fsm.dispose()
  })

  it('deterministic with seeded rng: two min-rng FSMs follow same schedule', () => {
    const alwaysMinRng = () => 0
    const events1: ConnectionFsmStatus[] = []
    const events2: ConnectionFsmStatus[] = []

    const fsm1 = createConnectionFsm({
      rng: alwaysMinRng,
      onChange: (s) => events1.push(s),
    })
    const fsm2 = createConnectionFsm({
      rng: alwaysMinRng,
      onChange: (s) => events2.push(s),
    })

    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(events1).toEqual(events2)

    fsm1.dispose()
    fsm2.dispose()
  })

  it('dispose stops automatic transitions', () => {
    const onChange = vi.fn()
    const alwaysMinRng = () => 0
    const fsm = createConnectionFsm({ rng: alwaysMinRng, onChange })
    fsm.dispose()
    onChange.mockClear()
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(onChange).not.toHaveBeenCalled()
  })
})
