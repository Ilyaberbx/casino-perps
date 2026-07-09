import { describe, it, expect, vi, beforeEach } from 'vitest'
import { imperativeToastQueue } from '../imperative-toast-queue'
import { toast } from '../toast'
import { resetImperativeToastQueue } from '../__fixtures__/reset-imperative-toast-queue'

describe('imperativeToastQueue', () => {
  beforeEach(() => {
    resetImperativeToastQueue()
  })
  it('drains pending events to a subscriber attached after enqueue', () => {
    const listener = vi.fn()
    const id1 = toast.show({ variant: 'info', title: 'A', id: 'a1' })
    const id2 = toast.show({ variant: 'info', title: 'B', id: 'b1' })
    const unsubscribe = imperativeToastQueue.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(id1).toBe('a1')
    expect(id2).toBe('b1')
    unsubscribe()
  })

  it('forwards subsequent events directly to the live subscriber', () => {
    const listener = vi.fn()
    const unsubscribe = imperativeToastQueue.subscribe(listener)
    toast.show({ variant: 'info', title: 'Direct', id: 'd1' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dedupes by id when smoke-test consumer fires twice with same id', () => {
    const listener = vi.fn()
    const unsubscribe = imperativeToastQueue.subscribe(listener)
    toast.show({
      variant: 'error',
      title: 'Session expired',
      description: 'Sign in again to continue',
      durationMs: Number.POSITIVE_INFINITY,
      id: 'session-expired',
    })
    toast.show({
      variant: 'error',
      title: 'Session expired',
      description: 'Sign in again to continue',
      durationMs: Number.POSITIVE_INFINITY,
      id: 'session-expired',
    })
    const showCalls = listener.mock.calls.filter(([event]) => event.kind === 'show')
    expect(showCalls).toHaveLength(2)
    const firstEvent = showCalls[0][0]
    const secondEvent = showCalls[1][0]
    expect(firstEvent.record.id).toBe('session-expired')
    expect(secondEvent.record.id).toBe('session-expired')
    unsubscribe()
  })
})
