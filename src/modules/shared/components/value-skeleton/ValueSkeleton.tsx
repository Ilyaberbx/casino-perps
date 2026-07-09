import styles from './value-skeleton.module.css'
import type { ValueSkeletonProps } from './value-skeleton.types'

const DEFAULT_WIDTH = 80
const DEFAULT_HEIGHT = 14
const DEFAULT_LABEL = 'Loading'

/**
 * A single shimmer bar standing in for an async scalar value (a balance, PnL,
 * an account handle) while it loads — the connected-but-in-flight counterpart to
 * the wallet-gate empty state (`$0.00` / `--`), never shown when disconnected.
 * Mirrors the `TableSkeleton` look (accent-soft fill, pixel border, opacity
 * pulse) and goes static under `prefers-reduced-motion`. A square `width` ===
 * `height` doubles as an avatar placeholder. Dumb leaf.
 */
export function ValueSkeleton({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
  ariaLabel = DEFAULT_LABEL,
}: ValueSkeletonProps) {
  const cls = className ? `${styles.bar} ${className}` : styles.bar
  return <span className={cls} style={{ width, height }} role="status" aria-label={ariaLabel} />
}
