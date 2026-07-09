// Canonical brand sprite data for the AI marker system (ADR-0050). The
// three-eyed invader is the dedicated AI mascot; `pnl-card.constants.ts`
// re-exports `AI_MASCOT_MATRIX` so there is one source of truth for the sprite.

/**
 * The brand three-eyed invader (`black3eye` / `white3eye` sprite) decoded to its
 * exact 20×20 pixel matrix — every `#` is one sprite pixel, `.` is transparent.
 * Rendered as crisp `<rect>`s filled in `currentColor`, so it theme-swaps by
 * contrast (bright on dark, dark on light) like the source GIFs.
 */
export const AI_MASCOT_MATRIX = [
  '....................',
  '......#......#......',
  '......##....##......',
  '.###.##########.###.',
  '.##################.',
  '.##################.',
  '...#####....#####...',
  '....###..##..###....',
  '...#####....#####...',
  '.##################.',
  '.##################.',
  '.##....######....##.',
  '.#..##..####..##..#.',
  '.##....######....##.',
  '.##################.',
  '.##################.',
  '.##.####.##.####.##.',
  '.#...##..##..##...#.',
  '.........##.........',
  '....................',
] as const

/** Mascot matrix is square; the SVG viewBox is `0 0 20 20` in cell units. */
export const AI_MASCOT_SIZE = 20

/** Default rendered px size for `AiMascot`. */
export const AI_MASCOT_DEFAULT_PX = 24
