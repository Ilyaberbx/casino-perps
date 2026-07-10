/** The scroll geometry of a horizontal carousel viewport, read off the DOM
 *  element (`scrollLeft`, `clientWidth`, `scrollWidth`). Snapshotting it into a
 *  plain object keeps the paging math pure and unit-testable. */
export interface ScrollMetrics {
  scrollLeft: number
  clientWidth: number
  scrollWidth: number
}

export type PageDirection = 'prev' | 'next'

// Sub-pixel slack. Browsers report fractional scroll offsets, and
// `scrollLeft + clientWidth` lands a hair under `scrollWidth` at the true end;
// without slack the "next" arrow would never disable on some zoom levels.
const EDGE_EPSILON_PX = 1

/** The furthest-left scroll offset reachable — 0 when the content does not
 *  overflow its viewport. */
function maxScrollLeft(metrics: ScrollMetrics): number {
  return Math.max(0, metrics.scrollWidth - metrics.clientWidth)
}

/** Whether a "previous page" scroll is possible (viewport is not at the start). */
export function canScrollPrev(metrics: ScrollMetrics): boolean {
  return metrics.scrollLeft > EDGE_EPSILON_PX
}

/** Whether a "next page" scroll is possible (viewport is not at the end). */
export function canScrollNext(metrics: ScrollMetrics): boolean {
  return metrics.scrollLeft < maxScrollLeft(metrics) - EDGE_EPSILON_PX
}

/**
 * The target `scrollLeft` after paging one viewport-width in `direction`,
 * clamped to `[0, maxScrollLeft]` so the arrows never overscroll past the ends.
 * One "page" is the full `clientWidth`.
 */
export function nextPageScrollLeft(metrics: ScrollMetrics, direction: PageDirection): number {
  const step = direction === 'next' ? metrics.clientWidth : -metrics.clientWidth
  const target = metrics.scrollLeft + step
  const clampedToStart = Math.max(0, target)
  return Math.min(clampedToStart, maxScrollLeft(metrics))
}
