import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/modules/shared/hooks/use-prefers-reduced-motion'
import {
  canScrollNext,
  canScrollPrev,
  nextPageScrollLeft,
  type PageDirection,
  type ScrollMetrics,
} from '../../utils/carousel-paging'

export interface UseCarouselResult {
  /** Attach to the horizontal scroll viewport. */
  scrollRef: React.RefObject<HTMLDivElement | null>
  canPrev: boolean
  canNext: boolean
  /** Page one viewport-width in `direction`, clamped to the ends. */
  page: (direction: PageDirection) => void
}

function readMetrics(el: HTMLDivElement): ScrollMetrics {
  return { scrollLeft: el.scrollLeft, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }
}

/**
 * Paging state for one carousel row. Owns the scroll-viewport ref, tracks
 * whether each arrow is live from the DOM scroll geometry, and pages by a full
 * viewport width. Scroll math lives in the pure `carousel-paging` util; this
 * hook only wires it to the element and to scroll/resize events.
 */
export function useCarousel(): UseCarouselResult {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const sync = useCallback(() => {
    const el = scrollRef.current
    if (el === null) return
    const metrics = readMetrics(el)
    setCanPrev(canScrollPrev(metrics))
    setCanNext(canScrollNext(metrics))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el === null) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [sync])

  const page = useCallback(
    (direction: PageDirection) => {
      const el = scrollRef.current
      if (el === null) return
      const left = nextPageScrollLeft(readMetrics(el), direction)
      const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'
      el.scrollTo({ left, behavior })
    },
    [prefersReducedMotion],
  )

  return { scrollRef, canPrev, canNext, page }
}
