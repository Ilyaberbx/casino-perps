import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { UseTabBarOptions, UseTabBarReturn } from './tab-bar.types'

/**
 * Owns the fitted strip's sliding-indicator measurement (issue #266). The old
 * approach positioned the bar by index assuming every tab is exactly
 * `100% / count` wide. That holds for 2-3 short tabs, but a strip like the
 * market-category tabs (ALL / CRYPTO / STOCKS / COMMODITIES / INDICES) cannot
 * shrink its long labels to equal widths on a narrow mobile viewport, so the
 * tabs become unequal + overflow-scroll and the index-positioned bar lands under
 * the wrong tab while the active tab shows its background — two markers.
 *
 * Instead, derive the indicator's offset + width from the **actual** active tab
 * element (`offsetLeft` / `offsetWidth`), so exactly one marker always tracks
 * the selected tab regardless of width or scroll. Re-measures on selection
 * change, tab-set change, and any size change (`ResizeObserver` on the strip +
 * its tabs). `offsetLeft` is content-relative, and the indicator is an absolute
 * child of the same scroll container, so the two stay aligned while the strip
 * scrolls horizontally.
 */
export function useTabBar({ value, fitted, tabCount }: UseTabBarOptions): UseTabBarReturn {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | null>(null)

  const measure = useCallback(() => {
    const list = listRef.current
    if (list === null) return
    const active = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (active === null) {
      setIndicatorStyle(null)
      return
    }
    setIndicatorStyle({
      width: `${active.offsetWidth}px`,
      transform: `translateX(${active.offsetLeft}px)`,
    })
  }, [])

  // Measure before paint on selection / tab-set change so the bar never flashes
  // at a stale position.
  useLayoutEffect(() => {
    if (!fitted) return
    measure()
  }, [fitted, value, tabCount, measure])

  // Track layout changes (container resize, label reflow, font load).
  useEffect(() => {
    if (!fitted) return
    const list = listRef.current
    if (list === null) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(list)
    for (const child of Array.from(list.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [fitted, tabCount, measure])

  return { listRef, indicatorStyle }
}
