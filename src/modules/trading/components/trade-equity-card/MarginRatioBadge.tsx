import type { MarginRatioBadgeProps } from './trade-equity-card.types'
import { formatMarginRatio, marginRatioBand } from './trade-equity-card.utils'
import styles from './trade-equity-card.module.css'

const BAND_CLASS = {
  safe: styles.badgeSafe,
  caution: styles.badgeCaution,
  danger: styles.badgeDanger,
} as const

/**
 * Account-health badge beside the Total Equity headline: the Margin Ratio %
 * colored by health band (green / amber / red). Hidden when there is no data.
 * The % text carries the meaning, so color is never the sole signal. Dumb leaf.
 */
export function MarginRatioBadge({ pct }: MarginRatioBadgeProps) {
  if (pct === null) return null
  const band = marginRatioBand(pct)
  return <span className={`${styles.badge} ${BAND_CLASS[band]}`}>{formatMarginRatio(pct)}</span>
}
