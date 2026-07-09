import { describe, it, expect, vi } from 'vitest'
import { createMockHistoryReader } from '../mock-history-reader'

const ROWS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('createMockHistoryReader', () => {
  it('emits the current (empty) entries on subscribe', () => {
    const reader = createMockHistoryReader(ROWS)
    const onUpdate = vi.fn()
    reader.subscribe(onUpdate)
    expect(onUpdate).toHaveBeenCalledWith([])
  })

  it('appends rows and broadcasts on the first loadOlder, reporting exhausted', async () => {
    const reader = createMockHistoryReader(ROWS)
    const onUpdate = vi.fn()
    reader.subscribe(onUpdate)

    const result = await reader.loadOlder()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
    expect(onUpdate).toHaveBeenLastCalledWith(ROWS)
  })

  it('is a no-op on subsequent loadOlder calls', async () => {
    const reader = createMockHistoryReader(ROWS)
    const onUpdate = vi.fn()
    reader.subscribe(onUpdate)

    await reader.loadOlder()
    const callsAfterFirst = onUpdate.mock.calls.length
    const second = await reader.loadOlder()

    expect(second._unsafeUnwrap()).toEqual({ exhausted: true })
    expect(onUpdate.mock.calls.length).toBe(callsAfterFirst)
  })

  it('stops emitting after unsubscribe', async () => {
    const reader = createMockHistoryReader(ROWS)
    const onUpdate = vi.fn()
    const unsubscribe = reader.subscribe(onUpdate)
    unsubscribe()

    await reader.loadOlder()
    // Only the initial subscribe emission; loadOlder must not reach a removed listener.
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})
