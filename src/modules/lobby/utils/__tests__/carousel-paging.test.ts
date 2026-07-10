import { describe, it, expect } from 'vitest'
import {
  canScrollNext,
  canScrollPrev,
  nextPageScrollLeft,
  type ScrollMetrics,
} from '../carousel-paging'

// A viewport 300px wide over 900px of content: 600px of scrollable range.
const AT_START: ScrollMetrics = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }
const MID: ScrollMetrics = { scrollLeft: 300, clientWidth: 300, scrollWidth: 900 }
const AT_END: ScrollMetrics = { scrollLeft: 600, clientWidth: 300, scrollWidth: 900 }
const NO_OVERFLOW: ScrollMetrics = { scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }

describe('carousel-paging — arrow availability', () => {
  it('disables prev at the start and enables next', () => {
    expect(canScrollPrev(AT_START)).toBe(false)
    expect(canScrollNext(AT_START)).toBe(true)
  })

  it('enables both arrows mid-scroll', () => {
    expect(canScrollPrev(MID)).toBe(true)
    expect(canScrollNext(MID)).toBe(true)
  })

  it('disables next at the end and enables prev', () => {
    expect(canScrollPrev(AT_END)).toBe(true)
    expect(canScrollNext(AT_END)).toBe(false)
  })

  it('disables both arrows when content does not overflow', () => {
    expect(canScrollPrev(NO_OVERFLOW)).toBe(false)
    expect(canScrollNext(NO_OVERFLOW)).toBe(false)
  })

  it('tolerates sub-pixel scroll offsets at the ends', () => {
    const nearStart: ScrollMetrics = { scrollLeft: 0.4, clientWidth: 300, scrollWidth: 900 }
    const nearEnd: ScrollMetrics = { scrollLeft: 599.6, clientWidth: 300, scrollWidth: 900 }
    expect(canScrollPrev(nearStart)).toBe(false)
    expect(canScrollNext(nearEnd)).toBe(false)
  })
})

describe('carousel-paging — nextPageScrollLeft', () => {
  it('pages forward by one viewport width', () => {
    expect(nextPageScrollLeft(AT_START, 'next')).toBe(300)
    expect(nextPageScrollLeft(MID, 'next')).toBe(600)
  })

  it('pages backward by one viewport width', () => {
    expect(nextPageScrollLeft(AT_END, 'prev')).toBe(300)
    expect(nextPageScrollLeft(MID, 'prev')).toBe(0)
  })

  it('clamps a forward page to the end (never overscrolls)', () => {
    expect(nextPageScrollLeft(AT_END, 'next')).toBe(600)
  })

  it('clamps a backward page to the start (never overscrolls)', () => {
    expect(nextPageScrollLeft(AT_START, 'prev')).toBe(0)
  })
})
