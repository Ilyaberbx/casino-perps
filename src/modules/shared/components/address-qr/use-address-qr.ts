import { useMemo } from 'react'
import { encodeQrMatrix, matrixToRects } from './address-qr.utils'
import type { QrRect } from './address-qr.types'

interface UseAddressQrResult {
  /** Pixel-aligned dark-module rects, or null when encoding failed. */
  readonly rects: ReadonlyArray<QrRect> | null
}

/**
 * Smart hook for `AddressQr`: encodes the raw address into a module matrix and
 * flattens it into pixel-aligned rects once per (value, size), swallowing the
 * (rare) encode failure into a null so the dumb component renders a fallback
 * instead of throwing.
 */
export function useAddressQr(value: string, size: number): UseAddressQrResult {
  const rects = useMemo<ReadonlyArray<QrRect> | null>(() => {
    const result = encodeQrMatrix(value)
    return result.isOk() ? matrixToRects(result.value, size) : null
  }, [value, size])

  return { rects }
}
