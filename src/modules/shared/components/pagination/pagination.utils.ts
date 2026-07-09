/**
 * Compute the windowed list of page numbers to render. Returns all pages when
 * they fit within `maxButtons`; otherwise a sliding window of `maxButtons`
 * pages centred on `page` and clamped to `[1, pageCount]`.
 */
export function pageWindow(page: number, pageCount: number, maxButtons: number): number[] {
  const total = Math.max(1, pageCount)
  const fitsWithoutWindowing = total <= maxButtons
  if (fitsWithoutWindowing) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const half = Math.floor(maxButtons / 2)
  const rawStart = page - half
  const maxStart = total - maxButtons + 1
  const start = Math.min(Math.max(1, rawStart), maxStart)
  return Array.from({ length: maxButtons }, (_, i) => start + i)
}
