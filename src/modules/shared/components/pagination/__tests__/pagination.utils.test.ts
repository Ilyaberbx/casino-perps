import { describe, it, expect } from 'vitest'
import { pageWindow } from '../pagination.utils'

describe('pageWindow', () => {
  it('returns every page when they fit within maxButtons', () => {
    expect(pageWindow(1, 3, 5)).toEqual([1, 2, 3])
    expect(pageWindow(2, 5, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('centres the window on the current page when overflowing', () => {
    expect(pageWindow(5, 10, 5)).toEqual([3, 4, 5, 6, 7])
  })

  it('clamps the window at the start', () => {
    expect(pageWindow(1, 10, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(2, 10, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('clamps the window at the end', () => {
    expect(pageWindow(10, 10, 5)).toEqual([6, 7, 8, 9, 10])
    expect(pageWindow(9, 10, 5)).toEqual([6, 7, 8, 9, 10])
  })

  it('treats a zero/negative page count as a single page', () => {
    expect(pageWindow(1, 0, 5)).toEqual([1])
  })
})
