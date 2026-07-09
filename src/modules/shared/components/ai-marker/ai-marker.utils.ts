import type { MascotCell } from './ai-marker.types'

/**
 * Decode a sprite matrix (`#` = filled, `.` = transparent) into the list of
 * filled cells, so the renderer can map each to a crisp `<rect>`. Pure.
 */
export function matrixToCells(matrix: readonly string[]): readonly MascotCell[] {
  const cells: MascotCell[] = []
  matrix.forEach((row, y) => {
    row.split('').forEach((cell, x) => {
      if (cell === '#') cells.push({ x, y })
    })
  })
  return cells
}
