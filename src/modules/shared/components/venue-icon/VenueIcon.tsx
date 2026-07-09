import { FallbackImage } from '@/modules/shared/components/fallback-image'
import { resolveVenueIconSources } from './venue-icon.utils'
import styles from './venue-icon.module.css'
import type { VenueIconProps } from './venue-icon.types'

/**
 * The single shared venue mark. Resolves the bundled icon via
 * `resolveVenueIconSources` (owning the `:network` base-id rule once) and
 * renders a decorative square image, falling back to the label's first-char
 * monogram when no asset is mapped (e.g. the Mock venue). Dumb — no state of its
 * own; the source-chain state lives in `FallbackImage`'s hook.
 */
export function VenueIcon({ venueId, label, size, className }: VenueIconProps) {
  const src = resolveVenueIconSources(venueId)
  const sources = src !== null ? [src] : []
  const monogram = (
    <span
      className={styles.monogram}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {label.charAt(0)}
    </span>
  )

  return (
    <FallbackImage
      sources={sources}
      alt=""
      fallback={monogram}
      className={className ?? styles.icon}
      width={size}
      height={size}
    />
  )
}
