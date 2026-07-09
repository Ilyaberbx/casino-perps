import styles from './pnl-card.module.css'
import { ARROW_COLS, ARROW_DOWN, ARROW_ROWS, ARROW_UP } from './pnl-card.constants'
import type { PnlSideArrowProps } from './pnl-card.types'

// Pixel direction arrow inside the side pill: up for long, down for short.
// Paints in `currentColor` (the pill's side accent). Stepped triangle keeps the
// sprite-icon language — integer geometry, no rounded vector glyph.
export function PnlSideArrow({ side }: PnlSideArrowProps) {
  const grid = side === 'long' ? ARROW_UP : ARROW_DOWN

  return (
    <svg
      className={styles.sideArrow}
      viewBox={`0 0 ${ARROW_COLS} ${ARROW_ROWS}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {grid.flatMap((rowText, row) =>
        rowText.split('').map((cell, col) =>
          cell === '#' ? (
            <rect key={`${row}-${col}`} x={col} y={row} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  )
}
