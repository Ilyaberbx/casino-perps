/** Leading technical label a venue gateway prepends to its error messages —
 *  e.g. "Hyperliquid API error:", "Hyperliquid SDK error:", "Hyperliquid HTTP
 *  error:", "Hyperliquid WebSocket error:". Venue-agnostic: matches any
 *  "<label> error:" prefix, not a hardcoded venue name. */
const VENUE_ERROR_PREFIX = /^[a-z][\w ]*?\berror:\s*/i

/** Strips the leading technical label from a venue error message so toasts show
 *  only the human-readable reason. The full prefixed message is kept in logs (it
 *  carries diagnostic detail); this strip is presentation-only. Falls back to the
 *  trimmed original when stripping would leave nothing. */
export function formatVenueErrorMessage(message: string): string {
  const stripped = message.replace(VENUE_ERROR_PREFIX, '').trim()
  if (!stripped) return message.trim()
  return stripped
}
