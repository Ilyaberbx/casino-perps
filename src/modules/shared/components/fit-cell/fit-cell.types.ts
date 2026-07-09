import type { ReactNode } from 'react'

/** Horizontal alignment of the cell content. Drives the `transform-origin`. */
export type FitCellAlign = 'left' | 'right'

export interface FitCellProps {
  readonly children: ReactNode
  /**
   * Anchor edge for the horizontal compression. `right` (default) keeps
   * right-aligned numbers pinned to the right edge as they squeeze; `left`
   * anchors to the left edge.
   */
  readonly align?: FitCellAlign
  /** Merged onto the outer `<span>`. */
  readonly className?: string
  /** Optional native `title` passthrough (full value on hover). */
  readonly title?: string
}

export interface UseFitCellResult {
  /** Attach to the clipping outer element (the column box). */
  readonly outerRef: React.RefObject<HTMLSpanElement | null>
  /** Attach to the inner content element whose natural width is measured. */
  readonly innerRef: React.RefObject<HTMLSpanElement | null>
  /**
   * `1` when the content fits; `clamp(containerWidth / contentWidth,
   * MIN_SCALE, 1)` when it overflows. Pass to the `--fit-scale` CSS var.
   */
  readonly scaleX: number
}
