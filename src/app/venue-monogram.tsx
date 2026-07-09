import styles from './venue-monogram.module.css'

/**
 * Terminal fallback tile for a venue with no loadable icon (remote favicon and
 * local asset both failed, or none configured — e.g. the Mock venue). Static
 * neutral monogram: the venue label's first letter on a token-driven chip. No
 * per-letter color hashing — a 2–3 item venue list doesn't need it (deliberate
 * divergence from `asset-icon`'s colored ramp; see grilled decision).
 */
export function VenueMonogram({ label }: { label: string }) {
  const letter = label.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={styles.monogram} role="img" aria-label={label}>
      {letter}
    </span>
  )
}
