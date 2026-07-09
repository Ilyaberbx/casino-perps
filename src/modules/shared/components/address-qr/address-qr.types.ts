export interface AddressQrProps {
  /**
   * The RAW receive address string to encode — never an EIP-681 / `ethereum:`
   * URI (a transfer URI scanned by the wrong wallet is a footgun). Hard
   * contract of this component (ADR-0029 D-5).
   */
  readonly value: string
  /** Rendered pixel size of the QR square. */
  readonly size: number
}

/** A square module matrix: `cells[row][col]` is true for a dark module. */
export interface QrMatrix {
  readonly count: number
  readonly cells: ReadonlyArray<ReadonlyArray<boolean>>
}

/** A single dark module's placement in pixel units. */
export interface QrRect {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly side: number
}

export type QrEncodeErrorKind = 'encode-failed'

export interface QrEncodeError {
  readonly kind: QrEncodeErrorKind
  readonly cause: unknown
}
