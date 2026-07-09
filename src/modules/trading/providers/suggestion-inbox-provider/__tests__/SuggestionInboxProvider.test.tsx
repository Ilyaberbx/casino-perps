import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { imperativeToastQueue } from '@/modules/shared/services/toast/imperative-toast-queue'
import type { ToastRecord } from '@/modules/shared/services/toast'
import { SUGGESTION_ACK_STORAGE_KEY } from '../../../services/suggestion-ack-store'
import { SuggestionInboxProvider } from '../SuggestionInboxProvider'
import { useSuggestionInbox } from '../use-suggestion-inbox'
import type { GetSuggestionInbox } from '../../../api/get-suggestion-inbox'
import type { SuggestionOutcome } from '../../../api/suggestions.types'

function outcome(overrides: Partial<SuggestionOutcome> = {}): SuggestionOutcome {
  return {
    id: 'a',
    status: 'pending',
    agentId: 'minara',
    symbol: 'BTC',
    style: 'day-trading',
    createdAt: '2026-06-14T10:00:00.000Z',
    resolvedAt: null,
    failureReason: null,
    ...overrides,
  }
}

/** Capture the toasts the global helper enqueues. */
function captureToasts(): { records: ToastRecord[]; stop: () => void } {
  const records: ToastRecord[] = []
  const stop = imperativeToastQueue.subscribe((event) => {
    if (event.kind === 'show') records.push(event.record)
  })
  return { records, stop }
}

/** A manual interval so the poll loop is deterministic (no real timers). */
function makeManualInterval() {
  const handlers = new Set<() => void>()
  return {
    createInterval: (handler: () => void) => {
      handlers.add(handler)
      return { clear: () => handlers.delete(handler) }
    },
    tick: () => {
      for (const handler of handlers) handler()
    },
  }
}

beforeEach(() => localStorage.clear())

describe('SuggestionInboxProvider', () => {
  it('toasts success once when a watched id completes, and bumps historyDirtyVersion', async () => {
    let phase: 'pending' | 'completed' = 'pending'
    const getInbox: GetSuggestionInbox = () =>
      okAsync([outcome({ id: 'w', status: phase, resolvedAt: phase === 'completed' ? 'x' : null })])
    const interval = makeManualInterval()
    const { records, stop } = captureToasts()

    let watch: (id: string) => void = () => undefined
    let dirty = 0
    function Probe() {
      const inbox = useSuggestionInbox()
      watch = inbox.watch
      dirty = inbox.historyDirtyVersion
      return null
    }

    render(
      <SuggestionInboxProvider enabled getInbox={getInbox} createInterval={interval.createInterval}>
        <Probe />
      </SuggestionInboxProvider>,
    )

    act(() => watch('w'))
    // Still pending — no toast yet.
    await waitFor(() => expect(records).toHaveLength(0))

    phase = 'completed'
    await act(async () => {
      interval.tick()
    })

    await waitFor(() => expect(records).toHaveLength(1))
    expect(records[0].variant).toBe('success')
    expect(records[0].title).toBe('Suggestion ready')
    expect(records[0].description).toBe('BTC')
    await waitFor(() => expect(dirty).toBeGreaterThan(0))

    // A further tick must NOT re-toast the same outcome (ack-set).
    await act(async () => {
      interval.tick()
    })
    expect(records).toHaveLength(1)
    stop()
  })

  it('toasts an error with a mapped reason on a watched failure', async () => {
    let phase: 'pending' | 'failed' = 'pending'
    const getInbox: GetSuggestionInbox = () =>
      okAsync([
        outcome({
          id: 'f',
          status: phase,
          failureReason: phase === 'failed' ? 'recovery-uncertain' : null,
        }),
      ])
    const interval = makeManualInterval()
    const { records, stop } = captureToasts()

    let watch: (id: string) => void = () => undefined
    function Probe() {
      watch = useSuggestionInbox().watch
      return null
    }
    render(
      <SuggestionInboxProvider enabled getInbox={getInbox} createInterval={interval.createInterval}>
        <Probe />
      </SuggestionInboxProvider>,
    )

    act(() => watch('f'))
    phase = 'failed'
    await act(async () => {
      interval.tick()
    })

    await waitFor(() => expect(records).toHaveLength(1))
    expect(records[0].variant).toBe('error')
    expect(records[0].title).toBe('Suggestion failed')
    expect(records[0].description).toMatch(/contact support/i)
    stop()
  })

  it('does not re-toast an already-acknowledged outcome across a remount (reload)', async () => {
    // Pre-seed the ack store as though the user already saw this outcome.
    localStorage.setItem(
      SUGGESTION_ACK_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [{ id: 'seen', ackedAt: Date.now() }] }),
    )
    const getInbox: GetSuggestionInbox = () =>
      okAsync([outcome({ id: 'seen', status: 'completed', resolvedAt: 'x' })])
    const { records, stop } = captureToasts()

    let watch: (id: string) => void = () => undefined
    function Probe() {
      watch = useSuggestionInbox().watch
      return null
    }
    render(
      <SuggestionInboxProvider enabled getInbox={getInbox}>
        <Probe />
      </SuggestionInboxProvider>,
    )
    act(() => watch('seen'))

    // Give the boot fetch a moment; the acked outcome must stay silent.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(records).toHaveLength(0)
    stop()
  })

  it('is inert when disabled (no fetch)', () => {
    const getInbox = vi.fn<GetSuggestionInbox>(() => okAsync([]))
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <SuggestionInboxProvider enabled={false} getInbox={getInbox}>
          {children}
        </SuggestionInboxProvider>
      )
    }
    renderHook(() => useSuggestionInbox(), { wrapper: Wrapper })
    expect(getInbox).not.toHaveBeenCalled()
  })
})
