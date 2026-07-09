import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { okAsync, errAsync } from 'neverthrow'
import { usePagedHistory } from '../use-paged-history'
import type { PagedHistoryReader } from '../use-paged-history.types'

vi.mock('@/modules/account', () => ({
  useAuth: () => ({ walletAddress: '0xabc' }),
  useIsWalletConnected: () => true,
}))

/** One-shot fake reader mirroring the real subscribe + loadOlder → exhausted shape. */
function makeReader<T>(rows: ReadonlyArray<T>): PagedHistoryReader<T> {
  const listeners = new Set<(entries: ReadonlyArray<T>) => void>()
  let entries: ReadonlyArray<T> = []
  let fetched = false
  return {
    subscribe(onUpdate) {
      listeners.add(onUpdate)
      onUpdate(entries)
      return () => listeners.delete(onUpdate)
    },
    loadOlder() {
      if (fetched) return okAsync({ exhausted: true })
      fetched = true
      entries = rows
      for (const listener of listeners) listener(entries)
      return okAsync({ exhausted: true })
    },
  }
}

describe('usePagedHistory', () => {
  it('loads the first page and reports exhausted', async () => {
    const reader = makeReader([{ id: 'a' }, { id: 'b' }])
    const { result } = renderHook(() => usePagedHistory(reader))

    // exhausted is set last (in the loadOlder microtask), so await it.
    await waitFor(() => expect(result.current.exhausted).toBe(true))
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.loadingMore).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('stays inert when the capability is absent', () => {
    const { result } = renderHook(() => usePagedHistory(undefined))
    expect(result.current.entries).toEqual([])
    expect(result.current.exhausted).toBe(false)
  })

  it('surfaces a loadOlder error', async () => {
    const reader: PagedHistoryReader<{ id: string }> = {
      subscribe: (onUpdate) => {
        onUpdate([])
        return () => {}
      },
      loadOlder: () => errAsync({ kind: 'network' }),
    }
    const { result } = renderHook(() => usePagedHistory(reader))
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'network' }))
    expect(result.current.loadingMore).toBe(false)
  })

  it('fetches the next page on loadOlder once the initial load settled', async () => {
    const loadOlder = vi.fn(() => okAsync({ exhausted: false }))
    const reader: PagedHistoryReader<{ id: string }> = {
      subscribe: (onUpdate) => {
        onUpdate([])
        return () => {}
      },
      loadOlder,
    }
    const { result } = renderHook(() => usePagedHistory(reader))
    await waitFor(() => expect(result.current.loadingMore).toBe(false))
    expect(loadOlder).toHaveBeenCalledTimes(1) // initial load

    await act(async () => {
      result.current.loadOlder()
    })
    expect(loadOlder).toHaveBeenCalledTimes(2)
  })
})
