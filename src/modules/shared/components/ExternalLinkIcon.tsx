/**
 * Pixel-styled "open in new tab" glyph. Stateless, prop-less leaf — used by any
 * row that links a hash to a venue's public block explorer (trades tape,
 * account-dock activity). `aria-hidden`: the surrounding `<a>` carries the
 * accessible label.
 */
export function ExternalLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  )
}
