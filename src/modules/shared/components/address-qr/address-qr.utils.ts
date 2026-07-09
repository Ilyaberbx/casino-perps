import { Result } from 'neverthrow'
import QRCode from 'qrcode'
import type { QrEncodeError, QrMatrix, QrRect } from './address-qr.types'

/**
 * Encode a raw string into a square module matrix. This is the only place the
 * `qrcode` encoder is imported (ADR-0029 D-4): the rest of the app sees the
 * plain `QrMatrix` and renders hard pixel modules itself. `QRCode.create`
 * throws on invalid input, so we wrap it at the boundary into a `Result`
 * (error-handling.md — no try/catch in feature code).
 */
export function encodeQrMatrix(value: string): Result<QrMatrix, QrEncodeError> {
  const create = Result.fromThrowable(
    () => QRCode.create(value, { errorCorrectionLevel: 'M' }),
    (cause): QrEncodeError => ({ kind: 'encode-failed', cause }),
  )

  return create().map((qr) => {
    const count = qr.modules.size
    const cells: boolean[][] = []
    for (let row = 0; row < count; row += 1) {
      const line: boolean[] = []
      for (let col = 0; col < count; col += 1) {
        line.push(qr.modules.get(row, col) === 1)
      }
      cells.push(line)
    }
    return { count, cells }
  })
}

/**
 * Flatten a module matrix into one pixel-aligned `<rect>` per dark module, sized
 * so `count` modules fill `size` pixels. Coordinates are floored to whole pixels
 * so modules render as hard, non-anti-aliased squares (with `crispEdges`).
 */
export function matrixToRects(matrix: QrMatrix, size: number): ReadonlyArray<QrRect> {
  const moduleSide = size / matrix.count
  const rects: QrRect[] = []

  matrix.cells.forEach((line, row) => {
    line.forEach((isDark, col) => {
      if (!isDark) return
      const x = Math.floor(col * moduleSide)
      const y = Math.floor(row * moduleSide)
      const side = Math.ceil(moduleSide)
      rects.push({ key: `${row}-${col}`, x, y, side })
    })
  })

  return rects
}
