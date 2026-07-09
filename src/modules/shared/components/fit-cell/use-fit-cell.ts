import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { MIN_SCALE } from './fit-cell.constants'
import type { UseFitCellResult } from './fit-cell.types'

function clampScale(ratio: number): number {
  if (ratio >= 1) return 1
  if (ratio < MIN_SCALE) return MIN_SCALE
  return ratio
}

/**
 * Owns the single-line fit logic for `FitCell`. Measures the inner content's
 * natural width (`scrollWidth`) against the clipping outer container's width
 * (`clientWidth`) and derives a horizontal compression factor. Re-measures via
 * a `ResizeObserver` on the outer element (column resize / horizontal scroll)
 * and on every render where the children may have changed; the observer is torn
 * down on unmount. No raf loop.
 */
export function useFitCell(): UseFitCellResult {
  const outerRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)
  const [scaleX, setScaleX] = useState(1)

  const measure = useCallback(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (outer === null || inner === null) return

    const containerWidth = outer.clientWidth
    const contentWidth = inner.scrollWidth

    const hasNoContent = contentWidth === 0
    const contentFits = contentWidth <= containerWidth
    if (hasNoContent || contentFits) {
      setScaleX(1)
      return
    }

    setScaleX(clampScale(containerWidth / contentWidth))
  }, [])

  // Set up the observer once. `measure` is stable (empty deps), so this runs on
  // mount and is torn down on unmount — no per-render observer churn.
  useLayoutEffect(() => {
    const outer = outerRef.current
    if (outer === null) return

    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [measure])

  // Re-measure on every render: the column width is stable across most renders
  // (the observer covers resize), but the children may have changed, which can
  // alter the content's natural width without resizing the outer box.
  useLayoutEffect(() => {
    measure()
  })

  return { outerRef, innerRef, scaleX }
}
