import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { StrictMode } from 'react'
import { okAsync, ResultAsync } from 'neverthrow'
import type { PaginatedHistoryReader } from '../account-dock.types'
import { usePaginatedHistoryReader } from '../use-paginated-history-reader'

function windowRows(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i)
}

/**
 * Synchronous fake reader: each `loadOlder()` appends the next window's rows,
 * notifies, and resolves immediately (okAsync). Tracks how many times it was
 * called so a test can tell the bootstrap load apart from a prefetch.
 */
function fakeReader(windows: ReadonlyArray<ReadonlyArray<number>>) {
  let index = 0
  let accumulated: number[] = []
  let listener: ((rows: ReadonlyArray<number>) => void) | null = null
  let calls = 0
  const reader: PaginatedHistoryReader<number> = {
    subscribe(onUpdate) {
      listener = onUpdate
      onUpdate(accumulated)
      return () => {
        listener = null
      }
    },
    loadOlder() {
      calls += 1
      const next = windows[index] ?? []
      index += 1
      accumulated = [...accumulated, ...next]
      listener?.(accumulated)
      return okAsync({ exhausted: index >= windows.length })
    },
  }
  return {
    reader,
    get calls() {
      return calls
    },
  }
}

/**
 * Fake reader faithful to `createPagedHistoryReader`'s lifecycle: the LAST
 * unsubscribe disposes accumulated rows and rotates a staleness generation, so
 * a fetch issued before the dispose is discarded when it lands. Fetches are
 * deferred and resolved manually via `resolveAll()` — the StrictMode
 * setup→cleanup(dispose)→setup cycle happens while the bootstrap is in flight,
 * exactly as in the browser.
 */
function fakeDisposingReader(rows: ReadonlyArray<number>) {
  const listeners = new Set<(next: ReadonlyArray<number>) => void>()
  let accumulated: ReadonlyArray<number> = []
  let generation = 0
  let fetchCalls = 0
  const pending: Array<() => void> = []
  const reader: PaginatedHistoryReader<number> = {
    subscribe(onUpdate) {
      listeners.add(onUpdate)
      onUpdate(accumulated)
      return () => {
        listeners.delete(onUpdate)
        if (listeners.size > 0) return
        accumulated = []
        generation += 1
      }
    },
    loadOlder() {
      fetchCalls += 1
      const requestedGeneration = generation
      const settled = new Promise<{ exhausted: boolean }>((resolve) => {
        pending.push(() => {
          const isStale = generation !== requestedGeneration
          if (!isStale) {
            accumulated = rows
            for (const listener of listeners) listener(accumulated)
          }
          resolve({ exhausted: !isStale })
        })
      })
      return ResultAsync.fromSafePromise(settled)
    },
  }
  return {
    reader,
    resolveAll() {
      pending.splice(0).forEach((resolve) => resolve())
    },
    get fetchCalls() {
      return fetchCalls
    },
  }
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/**
 * Reader whose every `loadOlder()` defers until the test resolves it in order,
 * choosing per call whether it emits rows (a live fetch) or nothing (a fetch the
 * real reader discards as stale after the address moved on). Models the refresh
 * race where the venue re-keys from the Primary to the Selected Wallet.
 */
function deferredReader() {
  let listener: ((rows: ReadonlyArray<number>) => void) | null = null
  let rows: number[] = []
  const calls: Array<(emitRows: boolean) => void> = []
  const reader: PaginatedHistoryReader<number> = {
    subscribe(onUpdate) {
      listener = onUpdate
      onUpdate(rows)
      return () => {
        listener = null
      }
    },
    loadOlder() {
      const settled = new Promise<{ exhausted: boolean }>((resolve) => {
        calls.push((emitRows: boolean) => {
          if (emitRows) {
            rows = [...rows, 42]
            listener?.(rows)
          }
          resolve({ exhausted: false })
        })
      })
      return ResultAsync.fromSafePromise(settled)
    },
  }
  return {
    reader,
    resolveCall(index: number, emitRows: boolean) {
      calls[index](emitRows)
    },
    get callCount() {
      return calls.length
    },
  }
}

describe('usePaginatedHistoryReader — StrictMode bootstrap', () => {
  it('populates page 1 under StrictMode when the dispose cycle kills the first bootstrap', async () => {
    // StrictMode runs the subscription effect setup → cleanup → setup. The
    // cleanup is the reader's last unsubscribe, so the reader disposes and
    // rotates its staleness generation — the setup-#1 bootstrap response is
    // discarded when it lands. The second setup must re-bootstrap under the
    // fresh generation, or every history tab renders an empty page 1 in dev.
    const fake = fakeDisposingReader(windowRows(0, 5))
    const { result } = renderHook(() => usePaginatedHistoryReader(fake.reader, 10), {
      wrapper: StrictMode,
    })

    await act(async () => {
      fake.resolveAll()
    })
    await flushAsync()

    // Rows render on page 1 WITHOUT the user clicking next.
    expect(result.current.rows).toEqual(windowRows(0, 5))
    expect(result.current.isLoading).toBe(false)
  })
})

describe('usePaginatedHistoryReader — reload while a stale load is in flight', () => {
  it('drains a reload signalled during an in-flight (doomed) load — the refresh bug', async () => {
    // The refresh bug: on a page refresh the Viewing Address settles in two
    // steps — the connected Primary Wallet resolves first (venue connects →
    // reload #1 → a recovery fetch starts), then the Selected Wallet loads from
    // the server and re-keys the venue (a second connect → reload #2). That
    // second reload lands while the first fetch is still in flight, so it can't
    // recover immediately. The first fetch then resolves against the old address
    // and the reader discards it as stale — emitting no rows. If reload #2 was
    // dropped, the tab stays empty until a page switch remounts the dock.
    const fake = deferredReader()
    const { result, rerender } = renderHook(
      ({ nonce }: { nonce: number }) => usePaginatedHistoryReader(fake.reader, 10, nonce),
      { initialProps: { nonce: 0 } },
    )
    // Bootstrap (call 0): the null-address bootstrap — resolves with no rows.
    await flushAsync()
    expect(fake.callCount).toBe(1)
    await act(async () => { fake.resolveCall(0, false) })

    // Primary connects → reload #1 → recovery fetch (call 1), left in flight.
    rerender({ nonce: 1 })
    await flushAsync()
    expect(fake.callCount).toBe(2)

    // Selected connects mid-flight → reload #2. Parked (a load is in flight).
    rerender({ nonce: 2 })
    await flushAsync()
    expect(fake.callCount).toBe(2)

    // Primary fetch lands stale → no rows. The parked reload must now drain and
    // issue call 2 against the settled Selected address.
    await act(async () => { fake.resolveCall(1, false) })
    await flushAsync()
    expect(fake.callCount).toBe(3)
    expect(result.current.rows).toEqual([])

    // Selected fetch lands → rows finally render, no page switch needed.
    await act(async () => { fake.resolveCall(2, true) })
    await flushAsync()
    expect(result.current.rows).toEqual([42])
  })
})

describe('usePaginatedHistoryReader — prefetch-ahead', () => {
  it('runs only the bootstrap load on mount (no prefetch)', async () => {
    const fake = fakeReader([windowRows(0, 15), windowRows(15, 15)])
    const { result } = renderHook(() => usePaginatedHistoryReader(fake.reader, 10))
    await flushAsync()

    expect(fake.calls).toBe(1)
    expect(result.current.count).toBe(15)
    expect(result.current.pagination.page).toBe(1)
    expect(result.current.pagination.pageCount).toBe(2)
  })

  it('prefetches the next window when the user pages to the last loaded page', async () => {
    const fake = fakeReader([windowRows(0, 15), windowRows(15, 15), windowRows(30, 15)])
    const { result } = renderHook(() => usePaginatedHistoryReader(fake.reader, 10))
    await flushAsync()
    expect(fake.calls).toBe(1)

    // Page to the last loaded page (2 of 2) — this is the loaded tail, so the
    // next window is fetched in the background ahead of the user's next click.
    await act(async () => {
      result.current.pagination.goNext()
    })
    await flushAsync()

    expect(result.current.pagination.page).toBe(2)
    expect(fake.calls).toBe(2)
    expect(result.current.count).toBe(30)
  })
})
