import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePaginatedHistory } from '../use-paginated-history'

function rangeRows(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

describe('usePaginatedHistory', () => {
  it('slices the current page from the loaded rows', () => {
    const { result } = renderHook(() =>
      usePaginatedHistory({
        rows: rangeRows(25),
        pageSize: 10,
        loadOlder: () => {},
        isExhausted: true,
        isLoading: false,
      }),
    )
    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(3)
    expect(result.current.pageRows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(result.current.canPrev).toBe(false)
    expect(result.current.canNext).toBe(true)
  })

  it('navigates forward and back within loaded pages', () => {
    const { result } = renderHook(() =>
      usePaginatedHistory({
        rows: rangeRows(25),
        pageSize: 10,
        loadOlder: () => {},
        isExhausted: true,
        isLoading: false,
      }),
    )
    act(() => result.current.goNext())
    expect(result.current.page).toBe(2)
    expect(result.current.pageRows).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    act(() => result.current.goNext())
    expect(result.current.page).toBe(3)
    expect(result.current.pageRows).toEqual([20, 21, 22, 23, 24])
    // Last page + exhausted ⇒ cannot go further.
    expect(result.current.canNext).toBe(false)
    act(() => result.current.goPrev())
    expect(result.current.page).toBe(2)
  })

  it('clamps goToPage into range', () => {
    const { result } = renderHook(() =>
      usePaginatedHistory({
        rows: rangeRows(25),
        pageSize: 10,
        loadOlder: () => {},
        isExhausted: true,
        isLoading: false,
      }),
    )
    act(() => result.current.goToPage(99))
    expect(result.current.page).toBe(3)
    act(() => result.current.goToPage(-5))
    expect(result.current.page).toBe(1)
  })

  it('allows Next past the loaded tail when more history may exist (not exhausted)', () => {
    const loadOlder = vi.fn()
    const { result } = renderHook(() =>
      usePaginatedHistory({
        rows: rangeRows(10),
        pageSize: 10,
        loadOlder,
        isExhausted: false,
        isLoading: false,
      }),
    )
    // One full page loaded, but not exhausted → Next is allowed and fetches.
    expect(result.current.canNext).toBe(true)
    act(() => result.current.goNext())
    expect(loadOlder).toHaveBeenCalledTimes(1)
    // Page does not advance yet — still waiting on the fetched rows.
    expect(result.current.page).toBe(1)
    expect(result.current.isFetchingMore).toBe(true)
  })

  it('auto-advances to the pending page once the fetched rows arrive', () => {
    const loadOlder = vi.fn()
    const { result, rerender } = renderHook(
      (props: { rows: number[]; isExhausted: boolean; isLoading: boolean }) =>
        usePaginatedHistory({
          rows: props.rows,
          pageSize: 10,
          loadOlder,
          isExhausted: props.isExhausted,
          isLoading: props.isLoading,
        }),
      { initialProps: { rows: rangeRows(10), isExhausted: false, isLoading: false } },
    )
    act(() => result.current.goNext())
    expect(result.current.isFetchingMore).toBe(true)
    // Fetch resolves with a second page of rows.
    rerender({ rows: rangeRows(20), isExhausted: false, isLoading: false })
    expect(result.current.page).toBe(2)
    expect(result.current.isFetchingMore).toBe(false)
    expect(result.current.pageRows).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  })

  it('settles on the last loaded page if the fetch returns nothing and exhausts', () => {
    const { result, rerender } = renderHook(
      (props: { rows: number[]; isExhausted: boolean; isLoading: boolean }) =>
        usePaginatedHistory({
          rows: props.rows,
          pageSize: 10,
          loadOlder: () => {},
          isExhausted: props.isExhausted,
          isLoading: props.isLoading,
        }),
      { initialProps: { rows: rangeRows(10), isExhausted: false, isLoading: true } },
    )
    act(() => result.current.goNext())
    expect(result.current.isFetchingMore).toBe(true)
    // Fetch completes with no new rows and exhaustion.
    rerender({ rows: rangeRows(10), isExhausted: true, isLoading: false })
    expect(result.current.isFetchingMore).toBe(false)
    expect(result.current.page).toBe(1)
    expect(result.current.canNext).toBe(false)
  })

  it('caps the page when the row list shrinks (e.g. address change reset)', () => {
    const { result, rerender } = renderHook(
      (props: { rows: number[] }) =>
        usePaginatedHistory({
          rows: props.rows,
          pageSize: 10,
          loadOlder: () => {},
          isExhausted: true,
          isLoading: false,
        }),
      { initialProps: { rows: rangeRows(25) } },
    )
    act(() => result.current.goToPage(3))
    expect(result.current.page).toBe(3)
    // List collapses to a single page worth of rows.
    rerender({ rows: rangeRows(5) })
    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(1)
    expect(result.current.pageRows).toEqual([0, 1, 2, 3, 4])
  })
})
