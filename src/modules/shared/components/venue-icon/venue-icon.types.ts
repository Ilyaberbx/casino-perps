export interface VenueIconProps {
  /** The venue id — may carry a `:network` suffix; resolution strips it. */
  venueId: string
  /** Venue label; its first character is the monogram fallback. */
  label: string
  /** Square edge length in pixels for both the icon and the monogram. */
  size: number
  className?: string
}
