import type { PortfolioHistoryErrorKind } from '../../../shared/domain'

export const SKELETON_HEIGHTS = [
  20, 40, 30, 55, 35, 70, 50, 25, 60, 45, 80, 35, 55, 40, 65, 30, 75, 50, 45, 60, 35, 70, 25, 55,
] as const

/**
 * Human-readable copy per Portfolio history error kind, shown in the chart's
 * error tile above the Reload button. Concise present-tense phrasing.
 */
export const CHART_ERROR_MESSAGE: Record<PortfolioHistoryErrorKind, string> = {
  'unknown-metric': 'This chart metric is not available right now.',
  'unknown-window': 'This time period is not available right now.',
  'wallet-not-connected': 'Connect your wallet to load chart history.',
  'unsupported-metric': 'This metric is not supported by this venue.',
} as const

/**
 * Target sample count the raw venue history is resampled up to before drawing.
 * The Hyperliquid portfolio endpoint returns a sparse series (~12–48 knots per
 * window); rendered as wide segments it reads blocky. We linearly interpolate to
 * an evenly-time-spaced dense series so the monotone line curves smoothly and the
 * X axis is uniform in clock time. See `densifyPortfolioPoints`.
 */
export const SMOOTH_TARGET_POINTS = 160

/**
 * Duration of the chart's left-to-right draw-on entry animation, in ms. The line
 * and its `fill: 'origin'` area sweep in from left to right by giving each dense
 * sample a per-point delay (`index * ENTRY_DURATION_MS / pointCount`). Collapsed
 * to an instant render under `prefers-reduced-motion`. See `usePortfolioChart`.
 */
export const ENTRY_DURATION_MS = 600
