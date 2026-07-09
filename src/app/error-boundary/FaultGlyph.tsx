/** Pixel-art alert mark for the crash screen — a hard-edged exclamation, no
 *  rounded vector glyph (DESIGN.md sprite-icon language). `currentColor`-aware
 *  so the frame's danger tint drives it. */
export function FaultGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="10" y="3" width="4" height="11" />
      <rect x="10" y="16" width="4" height="4" />
    </svg>
  )
}
