import { useVenueSwitcher } from './use-venue-switcher'
import { VenueMonogram } from './venue-monogram'
import { IconSelect } from '@/modules/shared/components/icon-select'
import type { IconSelectOption } from '@/modules/shared/components/icon-select'
import { FallbackImage } from '@/modules/shared/components/fallback-image'
import { useMediaQuery } from '@/modules/shared/hooks/use-media-query'
import styles from './venue-switcher.module.css'

// Keep in sync with the `max-width: 560px` header-condense query in
// app-shell.module.css: below it the header runs out of room, so the venue
// switcher drops its label to an icon-only chip.
const HEADER_COMPACT_QUERY = '(max-width: 560px)'

export function VenueSwitcher() {
  const { venueId, venues, onSelect } = useVenueSwitcher()
  const isCompact = useMediaQuery(HEADER_COMPACT_QUERY)

  const options: IconSelectOption[] = venues.map((venue) => {
    const sources = [venue.iconRemoteUrl, venue.iconLocalSrc].filter(
      (src): src is string => typeof src === 'string' && src.length > 0,
    )
    return {
      value: venue.id,
      label: venue.label,
      icon: (
        <FallbackImage
          sources={sources}
          alt={`${venue.label} icon`}
          fallback={<VenueMonogram label={venue.label} />}
        />
      ),
    }
  })

  return (
    <IconSelect
      options={options}
      value={venueId}
      onChange={onSelect}
      ariaLabel="Select Venue"
      iconOnly={isCompact}
      className={styles.switcher}
    />
  )
}
