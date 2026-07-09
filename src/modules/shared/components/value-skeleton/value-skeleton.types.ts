export interface ValueSkeletonProps {
  /** Bar width — number (px) or any CSS length. Defaults to a scalar-value width. */
  readonly width?: number | string
  /** Bar height in px. Defaults to a single text-line height. */
  readonly height?: number
  readonly className?: string
  /** Announced to assistive tech; defaults to a generic "Loading" label. */
  readonly ariaLabel?: string
}
